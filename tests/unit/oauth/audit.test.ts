/**
 * Unit tests for audit event logging.
 *
 * Tests the pure audit event construction functions:
 * - AuditEventType covers all OAuth operations
 * - classifySeverity returns elevated severity for security events
 * - createAuditEvent builds well-formed events with correct fields
 * - Security events (thumbprint mismatch, replay) are severity "security"
 * - Normal operations (token issued, bridge exchange) are severity "info"
 *
 * Step: 04-04
 */
import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import {
  classifySeverity,
  createAuditEvent,
  SECURITY_EVENT_TYPES,
  type AuditEventType,
} from "../../../app/src/server/oauth/audit";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_ACTOR = new RecordId("identity", "actor-123");
const TEST_WORKSPACE = new RecordId("workspace", "ws-456");
const TEST_INTENT = new RecordId("intent", "intent-789");
const TEST_THUMBPRINT = "sha256-test-thumbprint";

// ===========================================================================
// classifySeverity: auto-classify event severity by type
// ===========================================================================

describe("classifySeverity", () => {
  it("returns 'security' for dpop_rejected events", () => {
    expect(classifySeverity("dpop_rejected")).toBe("security");
  });

  it("returns 'security' for security_alert events", () => {
    expect(classifySeverity("security_alert")).toBe("security");
  });

  it("returns 'security' for token_rejected events", () => {
    expect(classifySeverity("token_rejected")).toBe("security");
  });

  it("returns 'info' for token_issued events", () => {
    expect(classifySeverity("token_issued")).toBe("info");
  });

  it("returns 'info' for intent_submitted events", () => {
    expect(classifySeverity("intent_submitted")).toBe("info");
  });

  it("returns 'info' for consent_approved events", () => {
    expect(classifySeverity("consent_approved")).toBe("info");
  });

  it("returns 'warning' for consent_vetoed events", () => {
    expect(classifySeverity("consent_vetoed")).toBe("warning");
  });

  it("returns 'warning' for consent_constrained events", () => {
    expect(classifySeverity("consent_constrained")).toBe("warning");
  });
});

// ===========================================================================
// SECURITY_EVENT_TYPES: exhaustive list of security-level events
// ===========================================================================

describe("SECURITY_EVENT_TYPES", () => {
  it("includes dpop_rejected", () => {
    expect(SECURITY_EVENT_TYPES).toContain("dpop_rejected");
  });

  it("includes security_alert", () => {
    expect(SECURITY_EVENT_TYPES).toContain("security_alert");
  });

  it("includes token_rejected", () => {
    expect(SECURITY_EVENT_TYPES).toContain("token_rejected");
  });
});

// ===========================================================================
// createAuditEvent: event factory
// ===========================================================================

describe("createAuditEvent", () => {
  it("builds a token_issued event with info severity", () => {
    const event = createAuditEvent("token_issued", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      intent_id: TEST_INTENT,
      dpop_thumbprint: TEST_THUMBPRINT,
      payload: { expires_at: "2026-03-10T12:00:00Z" },
    });

    expect(event.event_type).toBe("token_issued");
    expect(event.severity).toBe("info");
    expect(event.actor).toBe(TEST_ACTOR);
    expect(event.workspace).toBe(TEST_WORKSPACE);
    expect(event.intent_id).toBe(TEST_INTENT);
    expect(event.dpop_thumbprint).toBe(TEST_THUMBPRINT);
    expect(event.payload).toEqual({ expires_at: "2026-03-10T12:00:00Z" });
  });

  it("builds a dpop_rejected event with security severity", () => {
    const event = createAuditEvent("dpop_rejected", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      dpop_thumbprint: TEST_THUMBPRINT,
      payload: { reason: "thumbprint mismatch" },
    });

    expect(event.event_type).toBe("dpop_rejected");
    expect(event.severity).toBe("security");
  });

  it("builds a security_alert event with security severity", () => {
    const event = createAuditEvent("security_alert", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      payload: { reason: "replay detected", jti: "reused-jti" },
    });

    expect(event.event_type).toBe("security_alert");
    expect(event.severity).toBe("security");
    expect(event.payload.reason).toBe("replay detected");
  });

  it("omits intent_id when not provided", () => {
    const event = createAuditEvent("dpop_rejected", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      payload: { reason: "invalid proof" },
    });

    expect(event.intent_id).toBeUndefined();
  });

  it("omits dpop_thumbprint when not provided", () => {
    const event = createAuditEvent("intent_submitted", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      payload: { goal: "read workspace" },
    });

    expect(event.dpop_thumbprint).toBeUndefined();
  });

  it("auto-classifies consent_vetoed as warning severity", () => {
    const event = createAuditEvent("consent_vetoed", {
      actor: TEST_ACTOR,
      workspace: TEST_WORKSPACE,
      intent_id: TEST_INTENT,
      payload: { reason: "operator vetoed" },
    });

    expect(event.severity).toBe("warning");
  });
});
