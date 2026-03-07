// ---------------------------------------------------------------------------
// Agent spawning — thin adapter over Claude Agent SDK query()
// ---------------------------------------------------------------------------

import { buildAgentOptions, type AgentSpawnConfig } from "./agent-options";

// ---------------------------------------------------------------------------
// Port: QueryFn — the SDK's query() function signature
// ---------------------------------------------------------------------------

export type QueryResult = {
  [Symbol.asyncIterator](): AsyncIterator<unknown>;
  result: Promise<ConversationResponse>;
};

export type ConversationResponse = {
  conversationId: string;
};

export type QueryFn = (opts: {
  prompt: string;
  options: Record<string, unknown>;
}) => QueryResult;

// ---------------------------------------------------------------------------
// AgentHandle — returned by spawnAgent
// ---------------------------------------------------------------------------

export type AgentHandle = {
  messages: AsyncIterable<unknown>;
  abort: () => void;
  result: Promise<ConversationResponse>;
};

// ---------------------------------------------------------------------------
// SpawnAgentFn — port signature for agent spawning
// ---------------------------------------------------------------------------

export type SpawnAgentFn = (config: AgentSpawnConfig) => AgentHandle;

// ---------------------------------------------------------------------------
// createSpawnAgent — factory that injects the query function dependency
// ---------------------------------------------------------------------------

export function createSpawnAgent(queryFn: QueryFn): SpawnAgentFn {
  return (config: AgentSpawnConfig): AgentHandle => {
    const abortController = new AbortController();
    const agentOptions = buildAgentOptions(config, abortController);

    const conversation = queryFn({
      prompt: agentOptions.prompt,
      options: agentOptions.options as unknown as Record<string, unknown>,
    });

    return {
      messages: conversation,
      abort: () => abortController.abort(),
      result: conversation.result,
    };
  };
}
