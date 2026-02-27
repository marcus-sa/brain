import { tool } from "ai";
import { z } from "zod";
import { createEmbeddingVector } from "../../graph/embeddings";
import {
  parseRecordIdString,
  readEntityName,
  resolveWorkspaceProjectRecord,
  searchConversationMessagesByEmbedding,
  type GraphEntityRecord,
} from "../../graph/queries";
import { requireToolContext } from "./helpers";
import type { ChatToolDeps } from "./types";

export function createGetConversationHistoryTool(deps: ChatToolDeps) {
  return tool({
    description:
      "Search past conversations for discussions about a topic and return relevant message excerpts with linked entities.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Topic to search for"),
      projectId: z.string().optional().describe("Optional project scope filter"),
    }),
    execute: async (input, options) => {
      const context = requireToolContext(options);
      const queryEmbedding = await createEmbeddingVector(deps.embeddingModel, input.query, deps.embeddingDimension);
      if (!queryEmbedding) {
        throw new Error("failed to create query embedding for get_conversation_history");
      }

      const projectRecord = input.projectId
        ? await resolveWorkspaceProjectRecord({
            surreal: deps.surreal,
            workspaceRecord: context.workspaceRecord,
            projectInput: input.projectId,
          })
        : undefined;

      const messages = await searchConversationMessagesByEmbedding({
        surreal: deps.surreal,
        workspaceRecord: context.workspaceRecord,
        queryEmbedding,
        ...(projectRecord ? { projectRecord } : {}),
        limit: 8,
      });

      const enrichedMessages = await Promise.all(
        messages.map(async (message) => {
          const messageRecord = parseRecordIdString(message.id, ["message"], "message");
          const [entityRows] = await deps.surreal
            .query<[Array<GraphEntityRecord>]>(
              "SELECT VALUE out FROM extraction_relation WHERE `in` = $message LIMIT 8;",
              { message: messageRecord },
            )
            .collect<[Array<GraphEntityRecord>]>() ;

          const linkedEntities = await Promise.all(
            entityRows.map(async (entityRecord) => {
              const table = entityRecord.table.name;
              if (
                table !== "workspace" &&
                table !== "project" &&
                table !== "person" &&
                table !== "feature" &&
                table !== "task" &&
                table !== "decision" &&
                table !== "question"
              ) {
                return undefined;
              }

              const name = await readEntityName(deps.surreal, entityRecord);
              if (!name) {
                return undefined;
              }

              return {
                id: `${table}:${entityRecord.id as string}`,
                kind: table,
                name,
              };
            }),
          );

          return {
            messageId: `message:${message.id}`,
            conversationId: `conversation:${message.conversationId}`,
            excerpt: message.text.slice(0, 280),
            confidence: Number(message.score.toFixed(4)),
            linkedEntities: linkedEntities.filter((value) => value !== undefined),
          };
        }),
      );

      return {
        query: input.query,
        results: enrichedMessages,
      };
    },
  });
}
