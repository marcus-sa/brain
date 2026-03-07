import { describe, expect, test } from "bun:test";
import type {
  StreamEvent,
  AgentTokenEvent,
  AgentFileChangeEvent,
  AgentStatusEvent,
  AgentStallWarningEvent,
} from "../../../app/src/shared/contracts";

// Type-level assertion: if these compile, the types exist and are part of StreamEvent.
// At runtime we verify narrowing via the discriminated `type` field.

function narrowStreamEvent(event: StreamEvent): string {
  switch (event.type) {
    case "agent_token":
      return `token:${event.token}`;
    case "agent_file_change":
      return `file:${event.file}:${event.changeType}`;
    case "agent_status":
      return `status:${event.status}`;
    case "agent_stall_warning":
      return `stall:${event.stallDurationSeconds}s`;
    default:
      return event.type;
  }
}

describe("StreamEvent agent variants", () => {
  test("AgentTokenEvent is narrowable from StreamEvent", () => {
    const event: StreamEvent = {
      type: "agent_token",
      sessionId: "sess-1",
      token: "hello",
    };
    expect(narrowStreamEvent(event)).toBe("token:hello");
  });

  test("AgentFileChangeEvent is narrowable from StreamEvent", () => {
    const event: StreamEvent = {
      type: "agent_file_change",
      sessionId: "sess-1",
      file: "src/main.ts",
      changeType: "modified",
    };
    expect(narrowStreamEvent(event)).toBe("file:src/main.ts:modified");
  });

  test("AgentStatusEvent is narrowable from StreamEvent", () => {
    const event: StreamEvent = {
      type: "agent_status",
      sessionId: "sess-1",
      status: "completed",
    };
    expect(narrowStreamEvent(event)).toBe("status:completed");
  });

  test("AgentStallWarningEvent is narrowable from StreamEvent", () => {
    const event: StreamEvent = {
      type: "agent_stall_warning",
      sessionId: "sess-1",
      lastEventAt: "2026-03-07T08:00:00Z",
      stallDurationSeconds: 120,
    };
    expect(narrowStreamEvent(event)).toBe("stall:120s");
  });

  test("AgentStatusEvent supports optional error field", () => {
    const event: AgentStatusEvent = {
      type: "agent_status",
      sessionId: "sess-1",
      status: "error",
      error: "timeout exceeded",
    };
    expect(event.error).toBe("timeout exceeded");
  });

  test("AgentFileChangeEvent changeType is constrained to created|modified|deleted", () => {
    const validTypes: AgentFileChangeEvent["changeType"][] = [
      "created",
      "modified",
      "deleted",
    ];
    expect(validTypes).toHaveLength(3);
  });

  test("AgentStatusEvent status is constrained to valid values", () => {
    const validStatuses: AgentStatusEvent["status"][] = [
      "active",
      "idle",
      "completed",
      "aborted",
      "error",
    ];
    expect(validStatuses).toHaveLength(5);
  });
});
