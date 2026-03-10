# Intent Node: Component Boundaries

## Module Structure

```
app/src/server/intent/
  intent-queries.ts       -- SurrealDB CRUD, status transitions, traceability queries
  intent-routes.ts        -- HTTP handlers (evaluate endpoint, veto endpoint)
  authorizer.ts           -- LLM evaluation pipeline (policy gate + Haiku structured output)
  risk-router.ts          -- Pure function: evaluation result -> routing decision
  status-machine.ts       -- Pure function: validates status transitions
  veto-manager.ts         -- Veto window lifecycle (timer, SSE emission, expiry)
  types.ts                -- Intent domain types (algebraic data types)

schema/migrations/
  0021_intent_node.surql   -- intent table, relations, EVENT, authority_scope seeds
```

## Component Responsibilities

### intent-queries.ts (Effect Shell)
- CREATE intent records in SurrealDB
- UPDATE intent status with transition validation
- Query intents by workspace, status, time range
- Graph traversal queries for audit trail
- Recovery query: find intents stuck in `pending_veto` past `veto_expires_at`

### intent-routes.ts (Effect Shell)
- `POST /api/intents/:intentId/evaluate` -- receives SurrealQL EVENT callback; invokes authorizer pipeline
- `POST /api/intents/:intentId/veto` -- human veto endpoint; requires identity auth
- Request validation (origin check for EVENT callback, identity check for veto)
- Wired into `start-server.ts` route table

### authorizer.ts (Effect Shell wrapping Pure Core)
- Policy gate (pure): budget limit check, action allowlist validation
- LLM evaluation (effect): Haiku structured output with evaluation prompt
- Combines policy + LLM results into final evaluation
- Fallback: if LLM fails, policy-only result routes to veto window

### risk-router.ts (Pure Core)
- Input: evaluation result `{ decision, risk_score, reason }`
- Output: routing decision (discriminated union):
  - `{ route: "auto_approve" }` -- decision=APPROVE, risk_score <= threshold
  - `{ route: "veto_window" }` -- decision=APPROVE, risk_score > threshold
  - `{ route: "reject", reason }` -- decision=REJECT
- Zero side effects; fully testable

### status-machine.ts (Pure Core)
- Defines valid status transitions as a map
- Input: current status + requested transition
- Output: new status or error value
- Enforces: draft -> pending_auth -> authorized/vetoed -> executing -> completed/failed
- Prevents: backwards transitions, double-authorization

### veto-manager.ts (Effect Shell)
- Starts veto window timer (configurable duration)
- Emits SSE event to governance feed via existing `SseRegistry`
- On expiry: auto-approve (update intent status via intent-queries)
- On veto: cancel timer, update status, record veto reason + identity
- Recovery: on server start, query DB for intents in veto window; restart timers for unexpired, auto-approve expired

### types.ts (Pure -- Algebraic Data Types)
- `IntentStatus` -- discriminated union of all status values
- `IntentRecord` -- full intent shape matching SurrealDB schema
- `EvaluationResult` -- authorizer output shape
- `RoutingDecision` -- risk router output (tagged union)
- `StatusTransition` -- valid transition pair type
- `PolicyCheckResult` -- policy gate output

## Integration Points with Existing Code

### Modified Files

| File | Change |
|------|--------|
| `app/src/server/runtime/start-server.ts` | Register intent route handlers |
| `app/src/server/orchestrator/session-lifecycle.ts` | Add authorization gate in `createOrchestratorSession` |
| `app/src/server/feed/feed-queries.ts` | Add `listPendingIntents()` query for governance feed |
| `app/src/server/feed/feed-route.ts` | Include intent items in feed response |
| `app/src/shared/contracts.ts` | Add `IntentStatus` type, extend `GovernanceFeedAction` with "veto" |
| `schema/surreal-schema.surql` | Add intent table, relations, EVENT (via migration) |

### New MCP Tools (for worker agents)

| Tool | Purpose |
|------|---------|
| `create_intent` | Agent declares intent with goal, action_spec, reasoning, budget_limit |
| `submit_intent` | Agent transitions intent from draft to pending_auth |
| `get_intent_status` | Agent polls intent status (authorized/vetoed/failed) |

These tools are registered in MCP tool definitions, following the existing pattern in `mcp/mcp-route.ts`.

## Dependency Direction

```
                    Pure Core (no imports from effect shell)
                    ┌──────────────────────────────────┐
                    │  status-machine.ts                │
                    │  risk-router.ts                   │
                    │  types.ts                         │
                    └──────────┬───────────────────────┘
                               │ imported by
                    ┌──────────▼───────────────────────┐
                    │  Effect Shell                     │
                    │  authorizer.ts (imports types)    │
                    │  intent-queries.ts (imports types)│
                    │  veto-manager.ts (imports types)  │
                    │  intent-routes.ts (imports all)   │
                    └──────────────────────────────────┘
```

Dependencies flow inward: routes -> services -> pure core. Pure core has zero imports from effect shell.
