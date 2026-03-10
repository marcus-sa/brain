# ADR-011: Intent Authorization Gate Architecture

## Status

Proposed

## Context

Agents currently execute actions with full tool access scoped only by static `authority_scope` rules (agent_type -> action -> permission). There is no dynamic evaluation of whether a specific action is appropriate for a specific goal. Humans have no pre-execution visibility -- they review agent work post-hoc via PR review or session accept/reject.

The governance gap: between task assignment and agent execution, there is no checkpoint where the system evaluates whether the requested action is proportional, budgeted, and aligned with the task goal.

## Decision

Introduce an intent authorization gate as a new `intent` table and evaluation pipeline within the existing Bun server. The gate sits between task assignment and orchestrator session spawn.

**Architecture**: Modular monolith addition (new `app/src/server/intent/` module) with:
- SurrealQL EVENT trigger for reactive evaluation (no polling)
- Two-tier evaluation: hard policy rules first, LLM evaluation second
- Risk-based routing: auto-approve low-risk, veto window for high-risk, reject for bad intents
- Integration into existing orchestrator session lifecycle and governance feed

**Key design choice**: The authorization gate is advisory for Phase 1. The orchestrator checks `intent.status = authorized` before spawn but the intent creation is initiated by the worker agent, not enforced by the system. Phase 2 can make it mandatory.

## Alternatives Considered

### Alternative 1: Extend authority_scope with dynamic rules

Add conditions to `authority_scope` rows (budget ranges, action patterns) and evaluate at MCP tool execution time.

- **Pros**: No new table, builds on existing pattern, simpler
- **Expected impact**: ~40% of governance gap (static rules, no reasoning evaluation)
- **Why insufficient**: Cannot evaluate goal-action alignment, reasoning quality, or detect prompt injection. Static rules don't adapt to context.

### Alternative 2: Pre-execution webhook to external authorization service

Register webhooks that fire before each agent tool call. External service evaluates and returns allow/deny.

- **Pros**: Separation of concerns, could be shared across platforms
- **Expected impact**: ~70% of governance gap
- **Why insufficient**: Adds network hop to every tool call (latency), requires deploying/maintaining separate service (operational burden for solo dev), over-engineered for single-server deployment.

### Alternative 3: Post-execution audit with rollback

Let agents execute freely; an audit agent reviews actions after completion and flags/rolls back problematic ones.

- **Pros**: Zero latency added to execution, simpler happy path
- **Expected impact**: ~50% of governance gap (catches issues but after damage)
- **Why insufficient**: Some actions are irreversible (API calls, spending). Prevention is fundamentally better than detection for consequential actions.

## Consequences

### Positive

- Pre-execution visibility: humans see what agents intend before they act
- Full audit trail: every consequential action has a traceable authorization chain
- Graduated trust: low-risk auto-approves, high-risk gets human review
- Builds on existing patterns: same LLM SDK, SSE, feed, identity, authority_scope

### Negative

- Adds latency to agent execution (policy check + LLM eval: ~2-10s; veto window: up to 5 min)
- SurrealQL EVENT + http::post is fire-and-forget; needs stall detection for reliability
- LLM evaluation is non-deterministic; same intent may get different risk scores
- New table and relations increase schema surface

### Quality Attribute Impact

| Attribute | Impact | Direction |
|-----------|--------|-----------|
| Auditability | Full authorization chain in graph | Positive |
| Security | Pre-execution privilege escalation detection | Positive |
| Reliability | Fallback to policy-only on LLM failure | Neutral (mitigated) |
| Performance | +2-10s for evaluation, up to 5 min for veto window | Negative (acceptable) |
| Maintainability | New module follows existing patterns (effect shell/pure core) | Neutral |
