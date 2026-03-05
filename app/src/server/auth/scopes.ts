import type { AuthorityAction } from "../iam/authority";
import { jsonError } from "../http/response";

export const BRAIN_SCOPES = {
  "graph:read": "Read workspace graph data",
  "graph:reason": "Use reasoning tools (resolve decisions, check constraints)",
  "decision:write": "Create and confirm decisions",
  "task:write": "Create tasks, update status",
  "observation:write": "Log observations",
  "question:write": "Ask questions",
  "session:write": "Start and end agent sessions",
} as const;

export type BrainScope = keyof typeof BRAIN_SCOPES;

/** Map each authority action to the OAuth scope that gates it */
export const ACTION_SCOPE_MAP: Record<AuthorityAction, BrainScope> = {
  create_decision: "decision:write",
  confirm_decision: "decision:write",
  create_task: "task:write",
  complete_task: "task:write",
  create_observation: "observation:write",
  acknowledge_observation: "observation:write",
  resolve_observation: "observation:write",
  create_question: "question:write",
  create_suggestion: "task:write",
};

/** All scopes requested by default during brain init */
export const DEFAULT_CLI_SCOPES = Object.keys(BRAIN_SCOPES).join(" ");

/** Returns 403 Response if the token lacks the required scope, undefined otherwise */
export function requireScope(scopes: Set<string>, required: BrainScope): Response | undefined {
  if (!scopes.has(required)) {
    return jsonError(`insufficient scope: requires ${required}`, 403);
  }
  return undefined;
}
