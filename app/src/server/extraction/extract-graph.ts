import { generateObject } from "ai";
import {
  extractionResultSchema,
  type ExtractionPromptOutput,
} from "./schema";
import type { ExtractionGraphContextRow, MessageContextRow } from "./types";
import { elapsedMs, logError, logInfo } from "../http/observability";

export async function extractStructuredGraph(input: {
  extractionModel: any;
  conversationHistory: MessageContextRow[];
  currentMessage?: MessageContextRow;
  graphContext: ExtractionGraphContextRow[];
  sourceText: string;
  onboarding: boolean;
  heading?: string;
}): Promise<ExtractionPromptOutput> {
  const startedAt = performance.now();
  logInfo("extraction.generate.started", "Structured extraction started", {
    onboarding: input.onboarding,
    hasHeading: input.heading !== undefined,
    contextMessageCount: input.conversationHistory.length,
    hasCurrentMessage: input.currentMessage !== undefined,
    graphContextCount: input.graphContext.length,
    sourceLength: input.sourceText.length,
  });

  try {
    const extractionOutput = await generateObject({
      model: input.extractionModel,
      schema: extractionResultSchema,
      system: [
        "Extract structured business entities and relationships from the provided text.",
        "Return only high-confidence extractions with explicit entity references.",
        "Entity kinds: project, person, feature, task, decision, question.",
        "Each entity must include a tempId.",
        "Each entity must include evidence as a direct snippet from Current source text supporting the extraction.",
        "When Current message metadata is provided, only extract entities from Current message text and use Conversation history only for disambiguation.",
        "When Current message metadata is unavailable (for example document chunk extraction), do not emit resolvedFromMessageId.",
        "Conversation history may resolve pronouns or references (for example that/it/this/first option), but history alone must not introduce new entities.",
        "When resolving pronouns or callbacks from history, put the canonical referenced concept in entity text and keep the source pronoun phrase in evidence.",
        "If you resolved an entity from earlier context, include resolvedFromMessageId with the exact message id from Conversation history where that concept originates.",
        "Do not include resolvedFromMessageId when no earlier message resolution is required.",
        "Never set resolvedFromMessageId to Current message id.",
        "For confirmations like yes, let's go with that, sounds good, or I agree, resolve the decision text to the referenced concept from context (for example Use SurrealDB for the graph layer), not the literal confirmation phrase.",
        "Evidence must stay as the user's literal words from Current source text (for example Yes, let's go with that).",
        "If a confirmation cannot be resolved to one specific concept from context, do not emit an entity.",
        "When source text is a single question with alternatives (X or Y), extract one question entity for the decision point and do not extract each option as a separate entity.",
        "Commitment language indicates a decision entity, not a feature: let's go with, let's move forward with, we decided, I'm choosing, settled on, committed to.",
        "Declarative document/spec statements are valid extraction sources even without conversational markers like I decided or we should.",
        "Do not extract placeholders or generic references as entities: my project, the thing, this idea, that feature, our app, my business.",
        "Person mentions must map to existing workspace identities when possible; never assume a new identity should be created.",
        "Prefer canonical feature names over long paraphrases when multiple phrases describe the same capability.",
        "Each relationship must reference entities via fromTempId and toTempId.",
        "Each relationship must include fromText and toText snippets from the source text.",
        "Relationship kind is uppercase snake_case when possible (for example DEPENDS_ON, BLOCKS, RELATES_TO).",
        "Capture tools/providers explicitly mentioned in the tools array.",
        "Always include the tools key; use an empty array when no tools are mentioned.",
        "Confidence values must be between 0 and 1.",
        input.onboarding
          ? "Prioritize foundational onboarding entities: projects, people, first decisions, open questions, and constraints."
          : "Prioritize actionable entities and direct relationships.",
      ].join(" "),
      prompt: [
        "Conversation history (reference resolution only):",
        formatExtractionConversationHistory(input.conversationHistory),
        "",
        "Current message (extract only from this text when message metadata exists):",
        formatExtractionCurrentMessage(input.currentMessage, input.sourceText),
        "",
        "Existing graph context (semantic index of prior extracted entities):",
        formatExtractionGraphContext(input.graphContext),
        input.heading ? `Section heading: ${input.heading}` : "",
        "",
        "Current source text:",
        input.sourceText,
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
    });

    const output = extractionOutput.object as ExtractionPromptOutput;
    logInfo("extraction.generate.completed", "Structured extraction completed", {
      onboarding: input.onboarding,
      entityCount: output.entities.length,
      relationshipCount: output.relationships.length,
      toolCount: output.tools.length,
      durationMs: elapsedMs(startedAt),
    });

    return output;
  } catch (error) {
    logError("extraction.generate.failed", "Structured extraction failed", error, {
      onboarding: input.onboarding,
      durationMs: elapsedMs(startedAt),
    });
    throw error;
  }
}

function formatExtractionConversationHistory(rows: MessageContextRow[]): string {
  if (rows.length === 0) {
    return "(no prior messages)";
  }

  return rows.map((row) => `[message:${row.id.id as string}] ${row.role.toUpperCase()}: ${row.text}`).join("\n");
}

function formatExtractionCurrentMessage(currentMessage: MessageContextRow | undefined, sourceText: string): string {
  if (!currentMessage) {
    return `(no message metadata; source text: ${sourceText})`;
  }

  return `[message:${currentMessage.id.id as string}] ${currentMessage.role.toUpperCase()}: ${currentMessage.text}`;
}

function formatExtractionGraphContext(rows: ExtractionGraphContextRow[]): string {
  if (rows.length === 0) {
    return "(no prior extracted entities)";
  }

  return rows
    .map((row) => {
      const table = row.id.tb;
      return `[entity:${table}:${row.id.id as string}] ${row.kind}: ${row.text} (confidence ${row.confidence.toFixed(2)}, source message ${row.sourceMessage.id as string})`;
    })
    .join("\n");
}
