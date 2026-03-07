import { describe, expect, test } from "bun:test";
import {
  createSpawnAgent,
  type AgentHandle,
  type SpawnAgentFn,
  type QueryFn,
} from "../../../app/src/server/orchestrator/spawn-agent";
import type { AgentSpawnConfig } from "../../../app/src/server/orchestrator/agent-options";

// ---------------------------------------------------------------------------
// Stub: fake query function satisfying the QueryFn port signature
// ---------------------------------------------------------------------------

function createFakeQuery(options?: {
  messages?: Array<{ type: string }>;
  result?: { conversationId: string };
  shouldThrow?: Error;
}): { queryFn: QueryFn; calls: Array<unknown> } {
  const calls: Array<unknown> = [];
  const messages = options?.messages ?? [{ type: "assistant" }];
  const result = options?.result ?? { conversationId: "conv-1" };

  const queryFn: QueryFn = (opts) => {
    calls.push(opts);

    if (options?.shouldThrow) {
      throw options.shouldThrow;
    }

    // Return an object that is both AsyncIterable<Message> and has .result
    const iterable = {
      async *[Symbol.asyncIterator]() {
        for (const msg of messages) {
          yield msg;
        }
      },
      result: Promise.resolve(result),
    };

    return iterable;
  };

  return { queryFn, calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createSpawnAgent", () => {
  const defaultConfig: AgentSpawnConfig = {
    prompt: "Fix the bug",
    workDir: "/tmp/worktree/task-1",
    workspaceId: "ws-123",
    brainBaseUrl: "http://localhost:3000",
  };

  // -------------------------------------------------------------------------
  // Acceptance: spawnAgent returns AgentHandle with messages, abort, result
  // -------------------------------------------------------------------------

  test("returns AgentHandle with messages iterable and result promise", async () => {
    const { queryFn } = createFakeQuery({
      messages: [{ type: "assistant" }, { type: "result" }],
      result: { conversationId: "conv-42" },
    });

    const spawnAgent = createSpawnAgent(queryFn);
    const handle = spawnAgent(defaultConfig);

    expect(handle.messages).toBeDefined();
    expect(handle.abort).toBeInstanceOf(Function);
    expect(handle.result).toBeInstanceOf(Promise);

    // Consume messages
    const collected: Array<unknown> = [];
    for await (const msg of handle.messages) {
      collected.push(msg);
    }
    expect(collected).toHaveLength(2);

    const result = await handle.result;
    expect(result.conversationId).toBe("conv-42");
  });

  // -------------------------------------------------------------------------
  // Unit: passes built options to query function
  // -------------------------------------------------------------------------

  test("passes config through buildAgentOptions to query", () => {
    const { queryFn, calls } = createFakeQuery();

    const spawnAgent = createSpawnAgent(queryFn);
    spawnAgent(defaultConfig);

    expect(calls).toHaveLength(1);
    const passedOpts = calls[0] as Record<string, unknown>;
    expect(passedOpts).toHaveProperty("prompt", "Fix the bug");
    expect(passedOpts).toHaveProperty("options");
    const options = passedOpts.options as Record<string, unknown>;
    expect(options).toHaveProperty("cwd", "/tmp/worktree/task-1");
    expect(options).toHaveProperty("maxTurns", 200);
  });

  // -------------------------------------------------------------------------
  // Unit: abort function signals cancellation
  // -------------------------------------------------------------------------

  test("abort triggers the abort controller", () => {
    const { queryFn, calls } = createFakeQuery();

    const spawnAgent = createSpawnAgent(queryFn);
    const handle = spawnAgent(defaultConfig);

    // The abort controller should have been passed to query
    const passedOpts = calls[0] as Record<string, unknown>;
    const options = passedOpts.options as Record<string, unknown>;
    const controller = options.abortController as AbortController;
    expect(controller).toBeDefined();
    expect(controller.signal.aborted).toBe(false);

    handle.abort();

    expect(controller.signal.aborted).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Unit: spawn failure propagates (no partial state)
  // -------------------------------------------------------------------------

  test("query failure throws synchronously from spawnAgent", () => {
    const { queryFn } = createFakeQuery({
      shouldThrow: new Error("SDK initialization failed"),
    });

    const spawnAgent = createSpawnAgent(queryFn);

    expect(() => spawnAgent(defaultConfig)).toThrow(
      "SDK initialization failed"
    );
  });
});
