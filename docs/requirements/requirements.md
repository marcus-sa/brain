# Intent Node -- Requirements

## Feature Summary

The Intent Node is an authorization gate that sits between task assignment and agent execution. It transforms vague goals into auditable, scoped action requests that are evaluated by an LLM-based Authorizer Agent and optionally reviewed by humans through a passive veto window.

## Functional Requirements

### FR-1: Intent Schema
- Define `intent` table in SurrealDB (SCHEMAFULL)
- Required fields: requester (record<identity>), goal (string), status (enum), reasoning (string), action_spec (object), budget_limit (object), expiry (datetime), trace_id (string), created_at (datetime), priority (int)
- Status enum: draft, pending_auth, authorized, executing, completed, vetoed, failed

### FR-2: Intent Creation
- Worker agents create intents via graph write (CREATE intent)
- Intent must link to originating task via `triggered_by` relation
- Intent must link to requesting identity via `requests` relation

### FR-3: SurrealQL Event Handler
- Define EVENT on `intent` table that fires when status changes to `pending_auth`
- Event makes HTTP POST to `/api/intents/{id}/evaluate` with full intent payload
- Uses SurrealDB `http::post()` function
- Event fires only on transition TO pending_auth (not on every update)

### FR-4: Authorizer Agent Evaluation
- Server endpoint `POST /api/intents/:intentId/evaluate` receives intent payload
- Invokes LLM (Authorizer Agent) with system prompt evaluating:
  - Principle of least privilege (action_spec vs goal alignment)
  - Budget constraint check (action_spec cost vs budget_limit)
  - Reasoning quality (coherent chain of thought vs prompt injection)
- Returns structured output: `{ decision: "APPROVE" | "REJECT", risk_score: 0-100, reason: string }`
- Store evaluation result on intent record

### FR-5: Risk-Based Routing
- If decision = REJECT: intent status -> vetoed, stop
- If decision = APPROVE and risk_score <= 30: auto-approve, intent status -> authorized
- If decision = APPROVE and risk_score > 30: enter veto window

### FR-6: Passive Veto Window
- Emit intent to human feed via SSE (existing event bridge)
- Display intent summary, risk score, judge reasoning in feed
- Window duration: configurable per workspace (default 5 minutes)
- If no veto within window: auto-approve, intent status -> authorized
- If human vetoes: intent status -> vetoed, record veto reason

### FR-7: Execution Gate
- Orchestrator checks intent.status before spawning agent session
- Only spawn if status = "authorized"
- Pass action_spec parameters as scoped context to agent session
- Update intent status to "executing" on spawn
- Update intent status to "completed" or "failed" on session end

### FR-8: Graph Traceability
- Full traversal: task -> intent -> evaluation -> authorization -> agent_session -> result
- Each node has timestamps, actor identity, and status history

## Non-Functional Requirements

### NFR-1: Latency
- Judge evaluation must complete within 30 seconds
- Auto-approved intents (risk_score <= 30) add < 5 seconds to task execution

### NFR-2: Reliability
- If judge evaluation fails, fall back to policy-only check (budget + action allowlist)
- If policy check passes, route to veto window. If fails, reject.

### NFR-3: Security
- Event handler HTTP endpoint must validate request origin (SurrealDB internal)
- Intent records are workspace-scoped (same access model as tasks)

## Technical Requirements

### TR-1: SurrealQL Event Handler using http::post()
- Reference: https://surrealdb.com/docs/surrealql/functions/database/http
- Event definition in schema migration
- HTTP endpoint reachable from SurrealDB server (network access: https://surrealdb.com/docs/cloud/operate-and-manage/network-access)

### TR-2: Extend authority_scope
- Add intent-specific actions: "create_intent", "submit_intent", "evaluate_intent", "veto_intent"
- Authorizer agent_type gets "evaluate_intent" permission
- Human identity type gets "veto_intent" permission

### TR-3: Integration Points
- Orchestrator: session-lifecycle.ts (authorization gate before spawn)
- Event Bridge: emit intent lifecycle events via SSE
- Human Feed: render intent items with risk badges
