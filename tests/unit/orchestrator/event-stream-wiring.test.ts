/**
 * Event Stream Wiring: unit tests for startEventIteration
 *
 * Step 01-02: Wire event stream into session lifecycle
 *
 * Verifies that OpenCode events flow through the event bridge,
 * session transitions to active on first event, stall detector
 * receives signals, and iteration stops on terminal status or error.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { RecordId } from "surrealdb";
import {
  startEventIteration,
  clearHandleRegistry,
  type EventIterationDeps,
} from "../../../app/src/server/orchestrator/session-lifecycle";
import type { OpencodeEvent } from "../../../app/src/server/orchestrator/event-bridge";
import type { OrchestratorStatus } from "../../../app/src/server/orchestrator/types";

// ---------------------------------------------------------------------------
// Test helpers: async generators that simulate OpenCode event streams
// ---------------------------------------------------------------------------

function createOpencodeEventStream(
  events: OpencodeEvent[],
): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function createDelayedEventStream(
  events: Array<{ event: OpencodeEvent; delayMs: number }>,
): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const { event, delayMs } of events) {
        await Bun.sleep(delayMs);
        yield event;
      }
    },
  };
}

function createErrorStream(
  eventsBeforeError: OpencodeEvent[],
  error: Error,
): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of eventsBeforeError) {
        yield event;
      }
      throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Spy factory for EventIterationDeps
// ---------------------------------------------------------------------------

type DepsSpy = {
  deps: EventIterationDeps;
  emittedEvents: Array<{ streamId: string; event: unknown }>;
  statusUpdates: Array<{ sessionId: string; status: OrchestratorStatus; error?: string }>;
  lastEventAtCalls: string[];
  stallDetectorStarted: boolean;
  stallActivityCalls: number;
  stallStepCalls: number;
  stallStopped: boolean;
};

function createDepsSpy(options?: {
  sessionStatus?: OrchestratorStatus;
}): DepsSpy {
  const spy: DepsSpy = {
    deps: undefined as unknown as EventIterationDeps,
    emittedEvents: [],
    statusUpdates: [],
    lastEventAtCalls: [],
    stallDetectorStarted: false,
    stallActivityCalls: 0,
    stallStepCalls: 0,
    stallStopped: false,
  };

  spy.deps = {
    emitEvent: (streamId: string, event: unknown) => {
      spy.emittedEvents.push({ streamId, event });
    },
    updateSessionStatus: async (
      sessionId: string,
      status: OrchestratorStatus,
      error?: string,
    ) => {
      spy.statusUpdates.push({ sessionId, status, ...(error ? { error } : {}) });
    },
    updateLastEventAt: async (sessionId: string) => {
      spy.lastEventAtCalls.push(sessionId);
    },
    getSessionStatus: async (_sessionId: string) => {
      return options?.sessionStatus ?? "spawning";
    },
    startStallDetector: (_sessionId: string, _streamId: string) => ({
      recordActivity: () => { spy.stallActivityCalls++; },
      incrementStepCount: () => { spy.stallStepCalls++; },
      stop: () => { spy.stallStopped = true; },
    }),
  };

  spy.stallDetectorStarted = false;
  const originalStart = spy.deps.startStallDetector;
  spy.deps.startStallDetector = (sessionId, streamId) => {
    spy.stallDetectorStarted = true;
    return originalStart(sessionId, streamId);
  };

  return spy;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("startEventIteration (step 01-02)", () => {
  beforeEach(() => {
    clearHandleRegistry();
  });

  // -------------------------------------------------------------------------
  // Behavior 1: Events are forwarded through event bridge to SSE
  // -------------------------------------------------------------------------
  test("forwards agent events through event bridge to emitEvent", async () => {
    const events: OpencodeEvent[] = [
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "Hello" } },
      { type: "file.edited", sessionId: "oc-1", file: "src/index.ts" },
    ];
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createOpencodeEventStream(events),
      "stream-1",
      "sess-1",
    );

    await done;

    // Both events should have been forwarded
    expect(spy.emittedEvents).toHaveLength(2);
    expect(spy.emittedEvents[0].streamId).toBe("stream-1");

    // First event should be transformed to agent_token
    const firstEvent = spy.emittedEvents[0].event as { type: string };
    expect(firstEvent.type).toBe("agent_token");

    // Second event should be transformed to agent_file_change
    const secondEvent = spy.emittedEvents[1].event as { type: string };
    expect(secondEvent.type).toBe("agent_file_change");
  });

  // -------------------------------------------------------------------------
  // Behavior 2: Session transitions to active after first event
  // -------------------------------------------------------------------------
  test("transitions session to active after first agent event", async () => {
    const events: OpencodeEvent[] = [
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "Starting" } },
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "..." } },
    ];
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createOpencodeEventStream(events),
      "stream-1",
      "sess-1",
    );

    await done;

    // Should transition to active exactly once
    const activeUpdates = spy.statusUpdates.filter((u) => u.status === "active");
    expect(activeUpdates).toHaveLength(1);
    expect(activeUpdates[0].sessionId).toBe("sess-1");
  });

  // -------------------------------------------------------------------------
  // Behavior 3: Stall detector starts and receives activity signals
  // -------------------------------------------------------------------------
  test("starts stall detector and records activity for each event", async () => {
    const events: OpencodeEvent[] = [
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "token" } },
      { type: "file.edited", sessionId: "oc-1", file: "src/app.ts" },
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "more" } },
    ];
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createOpencodeEventStream(events),
      "stream-1",
      "sess-1",
    );

    await done;

    expect(spy.stallDetectorStarted).toBe(true);
    // Each event triggers recordActivity via event bridge
    expect(spy.stallActivityCalls).toBeGreaterThanOrEqual(3);
  });

  // -------------------------------------------------------------------------
  // Behavior 4: Stream error updates session to error status
  // -------------------------------------------------------------------------
  test("updates session to error status when event stream throws", async () => {
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createErrorStream(
        [{ type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "ok" } }],
        new Error("Connection lost"),
      ),
      "stream-1",
      "sess-1",
    );

    await done;

    // Should transition to error
    const errorUpdates = spy.statusUpdates.filter((u) => u.status === "error");
    expect(errorUpdates).toHaveLength(1);
    expect(errorUpdates[0].error).toContain("Connection lost");
  });

  // -------------------------------------------------------------------------
  // Behavior 5: Iteration stops on terminal session status (abort)
  // -------------------------------------------------------------------------
  test("stops iterating when session status becomes aborted", async () => {
    // Session status returns "aborted" after first event
    let eventCount = 0;
    const spy = createDepsSpy();
    spy.deps.getSessionStatus = async () => {
      eventCount++;
      return eventCount > 1 ? "aborted" : "active";
    };

    const events = createDelayedEventStream([
      { event: { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "a" } }, delayMs: 0 },
      { event: { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "b" } }, delayMs: 10 },
      { event: { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "c" } }, delayMs: 10 },
      { event: { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "d" } }, delayMs: 10 },
    ]);

    const done = startEventIteration(
      spy.deps,
      events,
      "stream-1",
      "sess-1",
    );

    await done;

    // Should have stopped before processing all 4 events
    expect(spy.emittedEvents.length).toBeLessThan(4);
    // Stall detector should be stopped on exit
    expect(spy.stallStopped).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Behavior 6: Stall detector stops when stream ends normally
  // -------------------------------------------------------------------------
  test("stops stall detector when event stream ends normally", async () => {
    const events: OpencodeEvent[] = [
      { type: "session.updated", sessionId: "oc-1", status: "idle" },
    ];
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createOpencodeEventStream(events),
      "stream-1",
      "sess-1",
    );

    await done;

    expect(spy.stallStopped).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Behavior 7: last_event_at is updated for each event
  // -------------------------------------------------------------------------
  test("updates last_event_at for each event received", async () => {
    const events: OpencodeEvent[] = [
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "a" } },
      { type: "message.part.updated", sessionId: "oc-1", part: { type: "text", content: "b" } },
    ];
    const spy = createDepsSpy();

    const done = startEventIteration(
      spy.deps,
      createOpencodeEventStream(events),
      "stream-1",
      "sess-1",
    );

    await done;

    expect(spy.lastEventAtCalls).toHaveLength(2);
    expect(spy.lastEventAtCalls[0]).toBe("sess-1");
  });
});
