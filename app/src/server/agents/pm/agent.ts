import { generateText } from "ai";
import { RecordId, Surreal } from "surrealdb";
import { z } from "zod";
import { ENTITY_CATEGORIES, type EntityCategory } from "../../../shared/contracts";
import { buildPmSystemPrompt } from "./prompt";
import { createPmTools } from "./tools";

const workItemSuggestionSchema = z.object({
  kind: z.enum(["task", "feature"]),
  title: z.string().min(1),
  rationale: z.string().min(1),
  category: z.enum(ENTITY_CATEGORIES).optional(),
  project: z.string().optional(),
  priority: z.string().optional(),
  possible_duplicate: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      similarity: z.number().min(0).max(1),
    })
    .optional(),
});

const pmAgentResultSchema = z.object({
  summary: z.string().min(1),
  suggestions: z.array(workItemSuggestionSchema),
  updated: z.array(
    z.object({
      existing_id: z.string().min(1),
      title: z.string().min(1),
      changes: z.string().min(1),
    }),
  ),
  discarded: z.array(
    z.object({
      title: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  observations_created: z.array(z.string().min(1)),
});

export type WorkItemSuggestion = {
  kind: "task" | "feature";
  title: string;
  rationale: string;
  category?: EntityCategory;
  project?: string;
  priority?: string;
  possible_duplicate?: {
    id: string;
    name: string;
    similarity: number;
  };
};

export type PmAgentResult = {
  summary: string;
  suggestions: WorkItemSuggestion[];
  updated: Array<{ existing_id: string; title: string; changes: string }>;
  discarded: Array<{ title: string; reason: string }>;
  observations_created: string[];
};

export type PmAgentInput = {
  surreal: Surreal;
  pmModel: any;
  embeddingModel: any;
  embeddingDimension: number;
  extractionModelId: string;
  workspaceRecord: RecordId<"workspace", string>;
  conversationRecord: RecordId<"conversation", string>;
  currentMessageRecord: RecordId<"message", string>;
  latestUserText: string;
  intent: "plan_work" | "check_status" | "organize" | "track_dependencies";
  context: string;
  project?: string;
  workspaceOwnerRecord?: RecordId<"person", string>;
};

function parseJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error("pm agent returned empty text");
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`pm agent output is not valid strict JSON: ${error instanceof Error ? error.message : "parse error"}`);
  }
}

export async function runPmAgent(input: PmAgentInput): Promise<PmAgentResult> {
  const system = await buildPmSystemPrompt({
    surreal: input.surreal,
    workspaceRecord: input.workspaceRecord,
  });
  const intentInstruction = input.intent === "check_status"
    ? "Primary action: call get_project_status when a project scope is available."
    : input.intent === "plan_work"
      ? "Primary action: propose tasks/features with suggest_work_items, deduping each item."
      : input.intent === "track_dependencies"
        ? "Primary action: identify blockers/dependencies and create observations for high-risk paths."
        : "Primary action: organize work into clear, deduplicated next steps.";

  const result = await generateText({
    model: input.pmModel,
    system,
    prompt: [
      "You are handling a PM request.",
      `Intent: ${input.intent}`,
      input.project ? `Project hint: ${input.project}` : "Project hint: not provided",
      intentInstruction,
      "Context:",
      input.context,
      "",
      "Return strict JSON only. Do not include markdown.",
      "Schema:",
      '{"summary": string, "suggestions": WorkItemSuggestion[], "updated": Array<{"existing_id": string, "title": string, "changes": string}>, "discarded": Array<{"title": string, "reason": string}>, "observations_created": string[]}',
    ].join("\n"),
    tools: createPmTools({
      surreal: input.surreal,
      embeddingModel: input.embeddingModel,
      embeddingDimension: input.embeddingDimension,
      extractionModelId: input.extractionModelId,
    }),
    experimental_context: {
      actor: "pm_agent",
      workspaceRecord: input.workspaceRecord,
      conversationRecord: input.conversationRecord,
      currentMessageRecord: input.currentMessageRecord,
      latestUserText: input.latestUserText,
      ...(input.workspaceOwnerRecord ? { workspaceOwnerRecord: input.workspaceOwnerRecord } : {}),
    },
    maxSteps: 5,
  });

  const parsed = pmAgentResultSchema.safeParse(parseJsonPayload(result.text));
  if (!parsed.success) {
    throw new Error(`pm agent output failed validation: ${parsed.error.message}`);
  }

  return parsed.data;
}
