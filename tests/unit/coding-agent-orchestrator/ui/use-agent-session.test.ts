import { describe, it, expect } from "bun:test";

/**
 * Tests for useAgentSession hook logic.
 *
 * Strategy: The hook's pure core is a state reducer (reduceAgentSessionEvent)
 * that maps SSE events to AgentSessionState transitions. We test the reducer
 * directly since it encodes all business rules. The EventSource wiring is a
 * thin adapter tested via integration/manual.
 *
 * Behaviors under test:
 *   1. agent_status events update status field
 *   2. agent_file_change events increment filesChanged counter
 *   3. agent_status with error sets error field
 *   4. agent_stall_warning sets stallWarning
 *   5. Any event resets stallWarning timer tracking (lastEventAt update)
 *   6. Terminal statuses (completed, aborted, error) are recognized
 */

import {
  reduceAgentSessionEvent,
  createInitialState,
  isTerminalStatus,
  STALL_TIMEOUT_MS,
  type AgentSessionState,
} from "../../../../app/src/client/hooks/use-agent-session";

// ---------------------------------------------------------------------------
// Acceptance: full event sequence produces correct final state
// ---------------------------------------------------------------------------

describe("useAgentSession reducer (acceptance)", () => {
  it("processes a full session lifecycle: spawning -> active -> file changes -> completed", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");

    // Agent becomes active
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "active",
    });
    expect(state.status).toBe("active");
    expect(state.filesChanged).toBe(0);

    // Agent modifies files
    state = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "src/main.ts",
      changeType: "modified",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "src/utils.ts",
      changeType: "created",
    });
    expect(state.filesChanged).toBe(2);

    // Agent completes
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "completed",
    });
    expect(state.status).toBe("completed");
    expect(state.filesChanged).toBe(2);
    expect(state.error).toBeUndefined();
    expect(state.stallWarning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unit: individual behaviors
// ---------------------------------------------------------------------------

describe("reduceAgentSessionEvent", () => {
  it("updates status from agent_status event", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "active",
    });
    expect(next.status).toBe("active");
  });

  it("increments filesChanged from agent_file_change event", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "index.ts",
      changeType: "created",
    });
    expect(next.filesChanged).toBe(1);

    const next2 = reduceAgentSessionEvent(next, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "utils.ts",
      changeType: "modified",
    });
    expect(next2.filesChanged).toBe(2);
  });

  it("sets error from agent_status error event", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "error",
      error: "process crashed",
    });
    expect(next.status).toBe("error");
    expect(next.error).toBe("process crashed");
  });

  it("sets stallWarning from agent_stall_warning event", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_stall_warning",
      sessionId: "s-1",
      lastEventAt: "2026-03-07T10:00:30Z",
      stallDurationSeconds: 45,
    });
    expect(next.stallWarning).toEqual({
      lastEventAt: "2026-03-07T10:00:30Z",
      stallDurationSeconds: 45,
    });
  });

  it("clears stallWarning when a non-stall event arrives", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_stall_warning",
      sessionId: "s-1",
      lastEventAt: "2026-03-07T10:00:30Z",
      stallDurationSeconds: 45,
    });
    expect(state.stallWarning).toBeDefined();

    // A status event clears the stall warning
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "active",
    });
    expect(state.stallWarning).toBeUndefined();
  });

  it("updates lastEventAt on every event", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "active",
    });
    expect(state.lastEventAt).toBeDefined();
  });

  it("preserves filesChanged across status transitions", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "a.ts",
      changeType: "created",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "idle",
    });
    expect(state.filesChanged).toBe(1);
    expect(state.status).toBe("idle");
  });
});

// ---------------------------------------------------------------------------
// isTerminalStatus
// ---------------------------------------------------------------------------

describe("isTerminalStatus", () => {
  it("returns true for completed, aborted, error", () => {
    expect(isTerminalStatus("completed")).toBe(true);
    expect(isTerminalStatus("aborted")).toBe(true);
    expect(isTerminalStatus("error")).toBe(true);
  });

  it("returns false for active, idle, spawning", () => {
    expect(isTerminalStatus("active")).toBe(false);
    expect(isTerminalStatus("idle")).toBe(false);
    expect(isTerminalStatus("spawning")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("STALL_TIMEOUT_MS", () => {
  it("is 30 seconds", () => {
    expect(STALL_TIMEOUT_MS).toBe(30_000);
  });
});
