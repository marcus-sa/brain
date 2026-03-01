import { tool } from "ai";
import { z } from "zod";
import { runPmAgent } from "../../agents/pm/agent";
import { requireToolContext } from "./helpers";
import type { OrchestratorToolDeps } from "./types";

export function createInvokePmAgentTool(deps: OrchestratorToolDeps) {
  return tool({
    description:
      "Invoke the PM subagent for planning work, checking project status, organizing initiatives, and tracking dependencies.",
    inputSchema: z.object({
      intent: z.enum(["plan_work", "check_status", "organize", "track_dependencies"]),
      context: z.string().min(1).describe("Conversation context for the PM agent"),
      project: z.string().optional().describe("Optional project scope"),
    }),
    execute: async (input, options) => {
      const context = requireToolContext(options);

      return runPmAgent({
        surreal: deps.surreal,
        pmModel: deps.pmModel,
        embeddingModel: deps.embeddingModel,
        embeddingDimension: deps.embeddingDimension,
        extractionModelId: deps.extractionModelId,
        workspaceRecord: context.workspaceRecord,
        conversationRecord: context.conversationRecord,
        currentMessageRecord: context.currentMessageRecord,
        latestUserText: context.latestUserText,
        intent: input.intent,
        context: input.context,
        ...(input.project ? { project: input.project } : {}),
        ...(context.workspaceOwnerRecord ? { workspaceOwnerRecord: context.workspaceOwnerRecord } : {}),
      });
    },
  });
}
