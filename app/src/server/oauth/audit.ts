/**
 * Audit Event Logging
 *
 * Simple audit event logging to SurrealDB for security-relevant
 * OAuth operations (token issuance, rejections, etc.).
 *
 * Step: 02-04
 */
import { RecordId, type Surreal } from "surrealdb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditEvent = {
  event_type: string;
  severity: "info" | "warning" | "security";
  actor: RecordId<"identity", string>;
  workspace: RecordId<"workspace", string>;
  intent_id?: RecordId<"intent", string>;
  dpop_thumbprint?: string;
  payload: Record<string, unknown>;
};

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
