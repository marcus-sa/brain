# Intent Node: Technology Stack

## Runtime

| Component | Technology | Version | License | Rationale |
|-----------|-----------|---------|---------|-----------|
| Server runtime | Bun | existing | MIT | Already in use; no new runtime |
| Database | SurrealDB | v3.0 | BSL 1.1 | Already in use; graph relations, EVENT triggers, SCHEMAFULL |
| LLM SDK | Vercel AI SDK | existing | Apache 2.0 | Already in use for PM/Analytics agents; structured output support |
| LLM (Authorizer) | Haiku (via OpenRouter) | existing | N/A | Cost-efficient for structured evaluation; same tier as extraction |
| Schema validation | Zod | existing | MIT | Already in use for agent output schemas |
| SSE streaming | Built-in (sse-registry.ts) | existing | N/A | Already in use for governance feed |

## No New Dependencies

The intent node requires zero new npm packages. All functionality builds on existing infrastructure:

- **LLM evaluation**: Same `ToolLoopAgent` / structured output pattern as PM agent
- **Database operations**: Same SurrealDB SDK patterns (RecordId, SCHEMAFULL)
- **SSE notifications**: Existing `SseRegistry.emitEvent()`
- **HTTP routing**: Existing Bun.serve route matching in start-server.ts
- **Timer**: Built-in `setTimeout` for veto window

## SurrealDB Features Used

| Feature | Usage |
|---------|-------|
| SCHEMAFULL table | `intent` table with strict field types and ASSERT constraints |
| DEFINE EVENT | Fires on `intent.status` transition to `pending_auth`; calls `http::post()` |
| TYPE RELATION | `triggered_by` (intent -> task), `gates` (intent -> agent_session), `vetoed_by` (identity -> intent), `evaluated_by` (intent -> intent_evaluation) |
| Graph traversal | Audit chain: `task -> triggered_by -> intent -> gates -> agent_session` |
| ASSERT enum | Status enum validation at database level |

## Configuration

| Setting | Default | Source |
|---------|---------|--------|
| Veto window duration | 300000ms (5 min) | Environment variable `INTENT_VETO_WINDOW_MS` |
| Auto-approve risk threshold | 30 | Environment variable `INTENT_AUTO_APPROVE_THRESHOLD` |
| Evaluation timeout | 30000ms | Environment variable `INTENT_EVAL_TIMEOUT_MS` |
| Authorizer model | Same as extraction model (Haiku) | Existing `EXTRACTION_MODEL` env var |

## Rejected Alternatives

### External message queue (Redis/BullMQ) for veto window
- **Why considered**: Durable timer for veto window expiry
- **Why rejected**: Single-server deployment, in-memory setTimeout sufficient. Veto window state is recoverable from DB (query intents in `pending_veto` with expired `veto_expires_at`)
- **Simpler alternative used**: setTimeout + DB-backed recovery on server restart

### Separate authorizer microservice
- **Why considered**: Isolate authorization logic
- **Why rejected**: Solo developer, single Bun process. Adding network boundary adds latency and operational complexity with zero benefit at this team size
- **Simpler alternative used**: Module within existing server (`app/src/server/intent/`)
