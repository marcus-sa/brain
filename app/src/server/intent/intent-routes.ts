import { jsonError, jsonResponse } from "../http/response";
import { logError, logInfo } from "../http/observability";
import { updateIntentStatus, listPendingIntents } from "./intent-queries";
import type { ServerDependencies } from "../runtime/types";
import type { IntentRecord } from "./types";

// --- Route Handler Types ---

type IntentRouteHandlers = {
  handleEvaluate: (request: Request) => Promise<Response>;
  handleVeto: (workspaceId: string, intentId: string, request: Request) => Promise<Response>;
  handleListPending: (workspaceId: string) => Promise<Response>;
};

// --- Factory ---

export function createIntentRouteHandlers(deps: ServerDependencies): IntentRouteHandlers {
  const { surreal } = deps;

  const handleEvaluate = async (request: Request): Promise<Response> => {
    // Called by SurrealQL EVENT via http::post - receives full intent record as body
    let body: IntentRecord;
    try {
      body = await request.json() as IntentRecord;
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const intentId = typeof body.id === "object" && body.id !== undefined
      ? (body.id.id as string)
      : undefined;

    if (!intentId) {
      return jsonError("Missing intent id in body", 400);
    }

    logInfo("intent.evaluate.received", "Evaluate endpoint received intent", {
      intentId,
      status: body.status,
      goal: body.goal,
    });

    // Stub: full evaluation logic wired in step 01-05
    return jsonResponse({ received: true, intentId }, 200);
  };

  const handleVeto = async (
    workspaceId: string,
    intentId: string,
    request: Request,
  ): Promise<Response> => {
    let body: { reason: string };
    try {
      body = await request.json() as { reason: string };
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body.reason || typeof body.reason !== "string" || body.reason.trim().length === 0) {
      return jsonError("reason is required", 400);
    }

    const result = await updateIntentStatus(surreal, intentId, "vetoed", {
      veto_reason: body.reason.trim(),
    });

    if (!result.ok) {
      logError("intent.veto.failed", result.error, { intentId, workspaceId });
      return jsonError(result.error, 409);
    }

    logInfo("intent.vetoed", "Intent vetoed by user", {
      intentId,
      workspaceId,
      reason: body.reason.trim(),
    });

    return jsonResponse({
      intentId,
      status: "vetoed",
    }, 200);
  };

  const handleListPending = async (workspaceId: string): Promise<Response> => {
    const intents = await listPendingIntents(surreal, workspaceId);

    return jsonResponse({
      intents: intents.map((intent) => ({
        id: intent.id.id as string,
        goal: intent.goal,
        reasoning: intent.reasoning,
        priority: intent.priority,
        action_spec: intent.action_spec,
        veto_expires_at: intent.veto_expires_at,
        created_at: intent.created_at,
      })),
    }, 200);
  };

  return { handleEvaluate, handleVeto, handleListPending };
}
