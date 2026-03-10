/**
 * Audit Event Logging
 *
 * Audit event logging to SurrealDB for security-relevant
 * OAuth operations (token issuance, rejections, DPoP verification,
 * consent actions, intent lifecycle).
 *
 * Pure domain types + SurrealDB adapter.
 *
 * Step: 02-04, 04-04
 */
import { RecordId, type Surreal } from "surrealdb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All event types matching the schema ASSERT values. */
export type AuditEventType =
  | "intent_submitted"
  | "intent_evaluated"
  | "intent_routed"
  | "consent_approved"
  | "consent_constrained"
  | "consent_vetoed"
  | "token_issued"
  | "token_rejected"
  | "dpop_verified"
  | "dpop_rejected"
  | "security_alert"
  | "policy_created"
  | "policy_activated"
  | "policy_updated"
  | "policy_deprecated";

export type AuditSeverity = "info" | "warning" | "security";

/** Security events that always get elevated severity. */
export const SECURITY_EVENT_TYPES: AuditEventType[] = [
  "dpop_rejected",
  "token_rejected",
  "security_alert",
];

/** Warning events that indicate operator intervention or constraint. */
const WARNING_EVENT_TYPES: AuditEventType[] = [
  "consent_vetoed",
  "consent_constrained",
];

/** Classify event severity by event type. */
export function classifySeverity(eventType: AuditEventType): AuditSeverity {
  if (SECURITY_EVENT_TYPES.includes(eventType)) return "security";
  if (WARNING_EVENT_TYPES.includes(eventType)) return "warning";
  return "info";
}

export type AuditEvent = {
  event_type: AuditEventType;
  severity: AuditSeverity;
  actor: RecordId<"identity", string>;
  workspace: RecordId<"workspace", string>;
  intent_id?: RecordId<"intent", string>;
  dpop_thumbprint?: string;
  payload: Record<string, unknown>;
};

/** Input for createAuditEvent -- event_type and severity are derived. */
export type AuditEventInput = {
  actor: RecordId<"identity", string>;
  workspace: RecordId<"workspace", string>;
  intent_id?: RecordId<"intent", string>;
  dpop_thumbprint?: string;
  payload: Record<string, unknown>;
};

/** Build an AuditEvent with auto-classified severity. */
export function createAuditEvent(
  eventType: AuditEventType,
  input: AuditEventInput,
): AuditEvent {
  return {
    event_type: eventType,
    severity: classifySeverity(eventType),
    actor: input.actor,
    workspace: input.workspace,
    ...(input.intent_id ? { intent_id: input.intent_id } : {}),
    ...(input.dpop_thumbprint ? { dpop_thumbprint: input.dpop_thumbprint } : {}),
    payload: input.payload,
  };
}

// ---------------------------------------------------------------------------
// Adapter: SurrealDB
// ---------------------------------------------------------------------------

export async function logAuditEvent(
  surreal: Surreal,
  event: AuditEvent,
): Promise<void> {
  const id = crypto.randomUUID();
  const record = new RecordId("audit_event", id);

  const content: Record<string, unknown> = {
    event_type: event.event_type,
    severity: event.severity,
    actor: event.actor,
    workspace: event.workspace,
    payload: event.payload,
    created_at: new Date(),
  };

  if (event.intent_id) {
    content.intent_id = event.intent_id;
  }
  if (event.dpop_thumbprint) {
    content.dpop_thumbprint = event.dpop_thumbprint;
  }

  await surreal.query("CREATE $record CONTENT $content;", {
    record,
    content,
  });
}
