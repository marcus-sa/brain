import { randomUUID } from "node:crypto";
import { RecordId } from "surrealdb";
import { z } from "zod";
import type { BranchConversationResponse } from "../../shared/contracts";
import type { ConversationRow } from "../extraction/types";
import { loadConversationGraphContext } from "../extraction/context-loaders";
import { HttpError } from "../http/errors";
import { logError, logInfo, logWarn } from "../http/observability";
import { jsonError, jsonResponse } from "../http/response";
import { resolveWorkspaceRecord } from "../workspace/workspace-scope";
import { deriveMessageTitle } from "../workspace/conversation-sidebar";
import type { ServerDependencies } from "../runtime/types";

const ENTITY_TABLES = ["task", "decision", "question", "feature", "project", "person"] as const;

const branchRequestSchema = z.object({
  contextEntityIds: z.array(z.string()).default([]),
});

export function createBranchConversationHandler(
  deps: ServerDependencies,
): (workspaceId: string, parentConversationId: string, request: Request) => Promise<Response> {
  return (workspaceId: string, parentConversationId: string, request: Request) =>
    handleBranchConversation(deps, workspaceId, parentConversationId, request);
}

async function handleBranchConversation(
  deps: ServerDependencies,
  workspaceId: string,
  parentConversationId: string,
  request: Request,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid JSON body", 400);
  }

  const parsed = branchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`invalid branch request: ${parsed.error.message}`, 400);
  }

  let workspaceRecord: RecordId<"workspace", string>;
  try {
    workspaceRecord = await resolveWorkspaceRecord(deps.surreal, workspaceId);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error.message, error.status);
    }
    logError("branch.workspace_resolve.failed", "Failed to resolve workspace", error, { workspaceId });
    return jsonError("failed to resolve workspace", 500);
  }

  try {
    const parentRecord = new RecordId("conversation", parentConversationId);
    const parent = await deps.surreal.select<ConversationRow>(parentRecord);
    if (!parent) {
      throw new HttpError(404, `conversation not found: ${parentConversationId}`);
    }

    if ((parent.workspace.id as string) !== (workspaceRecord.id as string)) {
      throw new HttpError(400, "conversation does not belong to workspace");
    }

    // Resolve context entity records
    let contextEntityRecords: RecordId[] = [];

    if (parsed.data.contextEntityIds.length > 0) {
      // Parse provided entity IDs, skip invalid ones
      for (const idString of parsed.data.contextEntityIds) {
        const normalized = idString.trim();
        const separatorIndex = normalized.indexOf(":");
        if (separatorIndex === -1) continue;

        const table = normalized.slice(0, separatorIndex);
        const id = normalized.slice(separatorIndex + 1);
        if (!(ENTITY_TABLES as readonly string[]).includes(table) || id.length === 0) continue;

        contextEntityRecords.push(new RecordId(table, id));
      }
    } else {
      // Auto-populate from parent conversation's extracted entities
      const parentEntities = await loadConversationGraphContext(deps.surreal, parentConversationId, 30);
      contextEntityRecords = parentEntities.map((row) => row.id as RecordId);
    }

    const now = new Date();
    const branchId = randomUUID();
    const branchRecord = new RecordId("conversation", branchId);
    const edgeRecord = new RecordId("branched_from", randomUUID());

    const branchTitle = parent.title
      ? deriveMessageTitle(`Branch of: ${parent.title}`)
      : "Branch";

    const transaction = await deps.surreal.beginTransaction();
    try {
      await transaction.create(branchRecord).content({
        createdAt: now,
        updatedAt: now,
        workspace: workspaceRecord,
        title: branchTitle,
        title_source: "message",
      });

      await transaction
        .relate(branchRecord, edgeRecord, parentRecord, {
          branched_at: now,
          context_entities: contextEntityRecords,
        })
        .output("after");

      await transaction.commit();
    } catch (error) {
      await transaction.cancel();
      throw error;
    }

    logInfo("branch.created", "Conversation branch created", {
      workspaceId,
      parentConversationId,
      branchId,
      contextEntityCount: contextEntityRecords.length,
    });

    const response: BranchConversationResponse = {
      conversationId: branchId,
      parentConversationId,
    };

    return jsonResponse(response, 201);
  } catch (error) {
    if (error instanceof HttpError) {
      logWarn("branch.http_error", "Branch creation failed with client-facing error", {
        workspaceId,
        parentConversationId,
        statusCode: error.status,
      });
      return jsonError(error.message, error.status);
    }

    logError("branch.failed", "Branch creation failed", error, {
      workspaceId,
      parentConversationId,
    });
    const message = error instanceof Error ? error.message : "branch creation failed";
    return jsonError(message, 500);
  }
}
