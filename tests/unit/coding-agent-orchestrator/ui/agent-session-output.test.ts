import { describe, it, expect } from "bun:test";

/**
 * Tests for AgentSessionOutput data model -- token accumulation, file change
 * inline notifications, and prompt-triggered reset.
 *
 * Pure core under test: reduceAgentSessionEvent handles agent_token,
 * agent_file_change, and agent_prompt events to build the output entries
 * array that AgentSessionOutput renders.
 *
 * Behaviors:
 *   1. agent_token events accumulate text into output entries
 *   2. agent_file_change events appear as inline notifications in output
 *   3. Token accumulation resets when agent_prompt event arrives
 *   4. Output entries maintain chronological order across event types
 */

import {
  reduceAgentSessionEvent,
  createInitialState,
  type AgentSessionState,
  type OutputEntry,
} from "../../../../app/src/client/hooks/use-agent-session";

// ---------------------------------------------------------------------------
// Acceptance: full token stream lifecycle
// ---------------------------------------------------------------------------

describe("agent session output (acceptance)", () => {
  it("accumulates tokens, shows file changes inline, resets on new prompt", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");

    // Agent becomes active
    state = reduceAgentSessionEvent(state, {
      type: "agent_status",
      sessionId: "s-1",
      status: "active",
    });

    // Token events stream in
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Hello ",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "world",
    });

    // Verify tokens accumulated
    const tokenEntries = state.outputEntries.filter(
      (e) => e.kind === "token",
    );
    expect(tokenEntries).toHaveLength(2);
    expect(tokenEntries[0].text).toBe("Hello ");
    expect(tokenEntries[1].text).toBe("world");

    // File change appears inline
    state = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "src/main.ts",
      changeType: "modified",
    });

    const fileEntries = state.outputEntries.filter(
      (e) => e.kind === "file_change",
    );
    expect(fileEntries).toHaveLength(1);
    expect(fileEntries[0].file).toBe("src/main.ts");
    expect(fileEntries[0].changeType).toBe("modified");

    // More tokens after file change
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: " - done",
    });
    expect(state.outputEntries).toHaveLength(4); // 2 tokens + 1 file + 1 token

    // User sends a follow-up prompt -- resets output
    state = reduceAgentSessionEvent(state, {
      type: "agent_prompt",
      sessionId: "s-1",
      text: "Now fix the tests",
    });

    // Output entries reset, prompt appears as first entry
    const promptEntries = state.outputEntries.filter(
      (e) => e.kind === "prompt",
    );
    expect(promptEntries).toHaveLength(1);
    expect(promptEntries[0].text).toBe("Now fix the tests");

    // Previous tokens are gone (reset)
    const tokensAfterReset = state.outputEntries.filter(
      (e) => e.kind === "token",
    );
    expect(tokensAfterReset).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Unit: individual output entry behaviors
// ---------------------------------------------------------------------------

describe("agent_token accumulation", () => {
  it("appends token text as output entry", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Hello",
    });

    expect(next.outputEntries).toHaveLength(1);
    expect(next.outputEntries[0].kind).toBe("token");
    expect(next.outputEntries[0].text).toBe("Hello");
  });

  it("preserves entry order across multiple tokens", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "first",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: " second",
    });

    expect(state.outputEntries).toHaveLength(2);
    expect(state.outputEntries[0].text).toBe("first");
    expect(state.outputEntries[1].text).toBe(" second");
  });
});

describe("file change inline notifications", () => {
  it("adds file change as output entry with file and changeType", () => {
    const state = createInitialState("2026-03-07T10:00:00Z");
    const next = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "lib/utils.ts",
      changeType: "created",
    });

    expect(next.outputEntries).toHaveLength(1);
    const entry = next.outputEntries[0];
    expect(entry.kind).toBe("file_change");
    expect(entry.file).toBe("lib/utils.ts");
    expect(entry.changeType).toBe("created");
  });

  it("interleaves file changes among token entries", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Working...",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_file_change",
      sessionId: "s-1",
      file: "src/index.ts",
      changeType: "modified",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Done.",
    });

    expect(state.outputEntries).toHaveLength(3);
    expect(state.outputEntries[0].kind).toBe("token");
    expect(state.outputEntries[1].kind).toBe("file_change");
    expect(state.outputEntries[2].kind).toBe("token");
  });
});

describe("prompt-triggered output reset", () => {
  it("clears previous output entries and adds prompt entry", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Old output",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_prompt",
      sessionId: "s-1",
      text: "Do something else",
    });

    expect(state.outputEntries).toHaveLength(1);
    expect(state.outputEntries[0].kind).toBe("prompt");
    expect(state.outputEntries[0].text).toBe("Do something else");
  });

  it("allows new tokens after prompt reset", () => {
    let state = createInitialState("2026-03-07T10:00:00Z");
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "Old",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_prompt",
      sessionId: "s-1",
      text: "New prompt",
    });
    state = reduceAgentSessionEvent(state, {
      type: "agent_token",
      sessionId: "s-1",
      token: "New output",
    });

    expect(state.outputEntries).toHaveLength(2);
    expect(state.outputEntries[0].kind).toBe("prompt");
    expect(state.outputEntries[1].kind).toBe("token");
    expect(state.outputEntries[1].text).toBe("New output");
  });
});
