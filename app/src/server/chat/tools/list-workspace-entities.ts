import { tool } from "ai";
import { z } from "zod";
import {
  listWorkspaceProjectSummaries,
  listWorkspaceRecentDecisions,
  listWorkspaceOpenQuestions,
} from "../../graph/queries";
import { listWorkspaceOpenObservations } from "../../observation/queries";
import { requireToolContext } from "./helpers";
import type { ChatToolDeps } from "./types";

const entityKindEnum = z.enum(["project", "decision", "question", "observation"]);

export function createListWorkspaceEntitiesTool(deps: ChatToolDeps) {
  return tool({
    description:
      "List workspace entities by kind. Use this to answer questions about what entities exist (e.g. \"what decisions are there?\", \"list open questions\"). For semantic search, use search_entities instead.",
    inputSchema: z.object({
      kind: entityKindEnum.describe("Entity kind to list."),
      status: z.string().optional().describe("Optional status filter, e.g. 'provisional', 'confirmed', 'open'. Decisions support: extracted, provisional, confirmed, resolved. Questions are always open."),
      limit: z.number().int().min(1).max(50).default(25).describe("Maximum number of results."),
    }),
    execute: async (input, options) => {
      const context = requireToolContext(options);

      if (input.kind === "project") {
        const projects = await listWorkspaceProjectSummaries({
          surreal: deps.surreal,
          workspaceRecord: context.workspaceRecord,
          limit: input.limit,
        });
        return {
          kind: "project",
          count: projects.length,
          entities: projects.map((p) => ({
            id: `project:${p.id}`,
            name: p.name,
            activeTaskCount: p.activeTaskCount,
          })),
        };
      }

      if (input.kind === "decision") {
        const decisions = await listWorkspaceRecentDecisions({
          surreal: deps.surreal,
          workspaceRecord: context.workspaceRecord,
          limit: input.limit,
        });
        const filtered = input.status
          ? decisions.filter((d) => d.status === input.status)
          : decisions;
        return {
          kind: "decision",
          count: filtered.length,
          entities: filtered.map((d) => ({
            id: `decision:${d.id}`,
            name: d.name,
            status: d.status,
            ...(d.priority ? { priority: d.priority } : {}),
            ...(d.project ? { project: d.project } : {}),
          })),
        };
      }

      if (input.kind === "question") {
        const questions = await listWorkspaceOpenQuestions({
          surreal: deps.surreal,
          workspaceRecord: context.workspaceRecord,
          limit: input.limit,
        });
        return {
          kind: "question",
          count: questions.length,
          entities: questions.map((q) => ({
            id: `question:${q.id}`,
            name: q.name,
            ...(q.priority ? { priority: q.priority } : {}),
            ...(q.project ? { project: q.project } : {}),
          })),
        };
      }

      if (input.kind === "observation") {
        const observations = await listWorkspaceOpenObservations({
          surreal: deps.surreal,
          workspaceRecord: context.workspaceRecord,
          limit: input.limit,
        });
        return {
          kind: "observation",
          count: observations.length,
          entities: observations.map((o) => ({
            id: `observation:${o.id}`,
            text: o.text,
            severity: o.severity,
            status: o.status,
            ...(o.category ? { category: o.category } : {}),
            sourceAgent: o.sourceAgent,
          })),
        };
      }

      throw new Error(`unsupported entity kind: ${input.kind}`);
    },
  });
}
