import { generateObject } from "ai";
import { RecordId, type Surreal } from "surrealdb";
import { z } from "zod";
import type { EntityKind, OnboardingState } from "../../shared/contracts";
import { chatComponentSystemPrompt } from "../chat/chat-component-system-prompt";
import { normalizeName } from "../extraction/normalize";
import { logWarn } from "../http/observability";
import { loadOnboardingSummary } from "./onboarding-state";

type MessageContextRow = {
  id: RecordId<"message", string>;
  role: "user" | "assistant";
  text: string;
  createdAt: Date | string;
  suggestions?: string[];
};

const assistantReplySchema = z.object({
  message: z.string().min(1),
  suggestions: z.array(z.string().min(1)).max(3),
});

export async function generateOnboardingAssistantReply(input: {
  assistantModel: any;
  surreal: Surreal;
  onboardingState: OnboardingState;
  contextRows: MessageContextRow[];
  latestUserText: string;
  workspaceRecord: RecordId<"workspace", string>;
  latestEntities: Array<{ kind: EntityKind; text: string; confidence: number }>;
  latestTools: string[];
}): Promise<{ message: string; suggestions: string[] }> {
  let systemPrompt = [
    "You are helping a product team capture actionable project state. Respond concisely with clear next actions.",
    "",
    "## UI Components",
    chatComponentSystemPrompt,
  ].join("\n");

  if (input.onboardingState === "active") {
    const summary = await loadOnboardingSummary(input.surreal, input.workspaceRecord);
    systemPrompt = [
      "You are onboarding a newly created workspace.",
      "Ask one natural question at a time like a smart colleague, never as a form.",
      "Cover these topics over 5-7 turns: business/venture, current projects, people involved, most important decision, tools used, biggest bottleneck.",
      "Keep acknowledgment to one sentence max.",
      "Reference at least one specific extracted entity or tool from the latest extraction context by name.",
      "Ask exactly one concrete follow-up question in every response.",
      "Do not produce generic praise or encouragement without a grounded follow-up question.",
      "Confirm captured entities inline in plain language.",
      "Return exactly 3 short clickable follow-up suggestions that move onboarding forward.",
      "Do not dump all questions at once.",
      "Current extracted context:",
      summary,
      "",
      "## UI Components",
      chatComponentSystemPrompt,
    ].join("\n");
  }

  if (input.onboardingState === "summary_pending") {
    const summary = await loadOnboardingSummary(input.surreal, input.workspaceRecord);
    systemPrompt = [
      "You are finishing onboarding for a workspace.",
      "Summarize what has been captured in a concise bullet list and ask if anything is missing or incorrect.",
      "End with an invitation to proceed into normal chat.",
      "Return exactly 3 short clickable follow-up suggestions.",
      "Current extracted context:",
      summary,
      "",
      "## UI Components",
      chatComponentSystemPrompt,
    ].join("\n");
  }

  const assistantResponse = await generateObject({
    model: input.assistantModel,
    schema: assistantReplySchema,
    system: systemPrompt,
    prompt: [
      "Return JSON with this shape: { message: string, suggestions: string[] }.",
      "Message may include markdown and ```component fenced JSON when useful.",
      "Suggestions must be short and actionable. Do not include numbering or punctuation-only entries.",
      "Conversation context:",
      formatContextRows(input.contextRows),
      "",
      "Latest extraction context:",
      formatLatestExtractionContext(input.latestEntities, input.latestTools),
      "",
      "Latest user message:",
      input.latestUserText,
    ].join("\n"),
  });

  let assistantText = assistantResponse.object.message.trim();
  if (assistantText.length === 0) {
    throw new Error("assistant response was empty");
  }

  if (input.onboardingState === "active") {
    const enforced = enforceActiveOnboardingReply(assistantText, input.latestEntities, input.latestTools);
    if (enforced.corrected) {
      logWarn("onboarding.reply.corrected", "Corrected onboarding assistant reply that failed quality guard", {
        reason: enforced.reason,
      });
      assistantText = enforced.message;
    }
  }

  const suggestions = [...new Set(assistantResponse.object.suggestions.map((value) => value.trim()))]
    .filter((value) => value.length > 0)
    .slice(0, 3);
  if (suggestions.length === 0) {
    throw new Error("assistant suggestions were empty");
  }

  return {
    message: assistantText,
    suggestions,
  };
}

function formatContextRows(rows: MessageContextRow[]): string {
  if (rows.length === 0) {
    return "(no prior messages)";
  }

  return rows.map((row) => `${row.role.toUpperCase()}: ${row.text}`).join("\n");
}

function formatLatestExtractionContext(
  entities: Array<{ kind: EntityKind; text: string; confidence: number }>,
  tools: string[],
): string {
  const entityLines = entities
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((entity) => `${entity.kind}: ${entity.text} (${entity.confidence.toFixed(2)})`);
  const toolLines = tools.slice(0, 10).map((tool) => `tool: ${tool}`);
  const lines = [...entityLines, ...toolLines];
  return lines.length > 0 ? lines.join("\n") : "(no extracted entities or tools)";
}

function enforceActiveOnboardingReply(
  message: string,
  entities: Array<{ kind: EntityKind; text: string; confidence: number }>,
  tools: string[],
): { message: string; corrected: boolean; reason?: string } {
  const groundingTerm = selectGroundingReference(entities, tools);
  const questionCount = [...message].filter((char) => char === "?").length;
  const hasGroundingReference = groundingTerm ? includesGroundingReference(message, [groundingTerm]) : true;

  if (questionCount === 1 && hasGroundingReference) {
    return { message, corrected: false };
  }

  const reason = questionCount !== 1
    ? "reply did not contain exactly one follow-up question"
    : "reply did not reference extracted entity or tool";
  const base = message.replace(/\?/g, ".").trim();
  const groundedPrefix = hasGroundingReference || !groundingTerm ? "" : `I captured ${groundingTerm}. `;
  const followUp = buildOnboardingFollowUpQuestion(groundingTerm);
  return {
    message: `${groundedPrefix}${base} ${followUp}`.trim(),
    corrected: true,
    reason,
  };
}

function selectGroundingReference(
  entities: Array<{ kind: EntityKind; text: string; confidence: number }>,
  tools: string[],
): string | undefined {
  const tool = tools.find((value) => value.trim().length >= 3);
  if (tool) {
    return tool.trim();
  }

  const topEntity = entities
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .find((entity) => entity.text.trim().length >= 3);
  return topEntity?.text.trim();
}

function includesGroundingReference(message: string, refs: string[]): boolean {
  const normalizedMessage = normalizeName(message);
  const normalizedRefs = refs.map((value) => normalizeName(value)).filter((value) => value.length >= 3);
  if (normalizedRefs.length === 0) {
    return true;
  }
  return normalizedRefs.some((value) => normalizedMessage.includes(value));
}

function buildOnboardingFollowUpQuestion(groundingTerm?: string): string {
  if (!groundingTerm) {
    return "What should we capture next to move onboarding forward?";
  }
  return `What's the current status of ${groundingTerm}?`;
}
