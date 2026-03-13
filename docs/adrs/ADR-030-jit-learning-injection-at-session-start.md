# ADR-030: JIT Learning Injection at Session Start

## Status
Proposed

## Context
Active learnings must be injected into agent system prompts. The question is timing: inject once at session/conversation start, or re-inject on every message.

## Decision
Inject learnings once when building the system prompt (session start). The existing `buildSystemPrompt`, `buildPmSystemPrompt`, `buildObserverSystemPrompt`, and `buildProjectContext` functions each call `loadActiveLearnings` once during their execution.

For the chat agent, this means once per `buildChatContext` call (which is per-conversation, not per-message, due to system prompt caching by the AI SDK). For MCP context, once per `buildProjectContext` or `buildWorkspaceOverview` call.

## Alternatives Considered

### Per-message injection with diff
- **What**: Check for new/changed learnings on every message. Inject only deltas.
- **Why rejected**: Adds a DB query per message on the hot path. Learning changes are rare (human creates ~1-5 per week). System prompt changes mid-conversation cause context confusion for LLMs. The chat agent already rebuilds system prompt per conversation, so new learnings are picked up on next conversation.

### Background subscription via LIVE SELECT
- **What**: SurrealDB LIVE SELECT on learning table. Push updates to active sessions.
- **Why rejected**: Over-engineered for the update frequency. Adds WebSocket complexity. Learning changes are rare enough that session-start loading is sufficient. Active conversations are typically short-lived relative to learning change frequency.

## Consequences
- **Positive**: One DB query per session start. No hot-path overhead. Simple implementation matching existing prompt builder pattern. New learnings picked up on next session/conversation.
- **Negative**: A learning activated mid-conversation won't be visible until the next conversation. Acceptable -- learnings are behavioral rules, not urgent context updates.
