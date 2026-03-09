# ADR-012: SurrealQL EVENT for Intent Evaluation Trigger

## Status

Proposed

## Context

When an intent transitions to `pending_auth`, the authorizer evaluation pipeline must be triggered. Three patterns were considered for this reactive trigger.

## Decision

Use SurrealQL `DEFINE EVENT` with `http::post()` to trigger the evaluation endpoint. The event fires on the specific transition `$before.status != "pending_auth" AND $after.status = "pending_auth"`, providing an idempotent guard against double-firing.

The event calls back to the same Bun server process via localhost HTTP, keeping the evaluation pipeline as a standard HTTP handler.

## Alternatives Considered

### Alternative 1: Application-layer polling

Poll the `intent` table every N seconds for records with `status = "pending_auth"`.

- **Pros**: Simple, no SurrealDB event dependency, works with any database
- **Why rejected**: Adds latency (up to poll interval), wastes resources when no intents are pending, doesn't scale perception of real-time responsiveness

### Alternative 2: Application-layer trigger in update function

After updating intent status in TypeScript, directly call the evaluation function in the same request.

- **Pros**: Synchronous, no event infrastructure, simpler debugging
- **Why rejected**: Couples intent submission to evaluation; if the agent creates and submits in one MCP call, the evaluation blocks the response. Also prevents future scenarios where intents are created by other paths (e.g., scheduled tasks).

### Alternative 3: SurrealDB LIVE SELECT in application

Use LIVE SELECT to watch for intent status changes and react in application code.

- **Pros**: Application-layer control, uses SurrealDB streaming capability
- **Why rejected**: Requires WebSocket connection (project uses HTTP transport per CLAUDE.md conventions). LIVE SELECT needs persistent connection management that adds complexity.

## Consequences

### Positive

- Reactive: evaluation starts immediately on status change, no polling delay
- Decoupled: intent creation and evaluation are separate concerns
- Idempotent: `$before.status` guard prevents double-firing
- Observable: HTTP call is logged by request-logging middleware

### Negative

- Fire-and-forget: if the HTTP call fails, SurrealDB does not retry. Requires application-level stall detection (query for intents stuck in `pending_auth` past a timeout threshold)
- Localhost network dependency: requires server to be reachable from SurrealDB process on same host
- Port configuration: EVENT definition must know the server port at migration time

### Mitigation

**Recovery sweep**: On server start and periodically (every 60s), query for intents in `pending_auth` older than 60 seconds and re-trigger evaluation. This handles EVENT failures, server restarts during evaluation, and SurrealDB connectivity blips.

**Port configuration**: The EVENT definition references `http://127.0.0.1:{PORT}/api/intents/...`. Two options:
1. **Migration-time substitution**: The migration script uses a placeholder that `bun migrate` replaces with the `PORT` env var before applying. This is the simpler approach.
2. **SurrealDB param**: Define a database-level param (`DEFINE PARAM $brain_base_url VALUE "http://127.0.0.1:3100"`) and reference it in the EVENT. Update the param on config change.

Option 1 is recommended for simplicity. The recovery sweep provides a safety net if the port changes between migration and runtime.
