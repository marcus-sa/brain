# Intent Node: Walking Skeleton Design

## Selected Skeletons

### Skeleton 1: Low-risk intent auto-approved

**User journey**: Agent creates intent -> submits for auth -> evaluator approves with low risk -> intent authorized -> ready for execution

**What it proves**:
- An agent can declare its intent with goal, reasoning, and action specification
- The intent lifecycle transitions correctly: draft -> pending_auth -> authorized
- The evaluation pipeline produces a decision with risk score
- Low-risk intents (score <= 30) bypass the veto window entirely
- The intent record preserves the full authorization chain for audit

**Stakeholder demo**: "An agent that wants to fix a typo in the README declares what it wants to do and why. The system evaluates it as safe and approves it immediately, without bothering a human."

### Skeleton 2: High-risk intent vetoed by human

**User journey**: Agent creates intent for destructive action -> submits for auth -> evaluator flags as high-risk -> enters veto window -> human vetoes -> intent blocked

**What it proves**:
- High-risk intents (score > 30) enter the veto window instead of auto-approving
- Pending intents are surfaced for human review (governance feed query)
- A human can veto an intent within the veto window
- Vetoed intents are blocked from execution
- The veto reason is recorded for audit trail

**Stakeholder demo**: "An agent that wants to delete database tables declares what it wants to do. The system flags it as high-risk and shows it to the workspace owner. The owner reads the agent's plan, decides it's too risky, and blocks it with a note asking for a rollback migration first."

## Why These Two Skeletons

The intent node is fundamentally a binary gate: authorize or block. The two skeletons cover both outcomes of that gate:

1. **Authorize**: The happy path where safe work flows through with minimal friction
2. **Block**: The safety mechanism where risky work is caught and stopped

Any other scenario is a variation of these two paths (different risk scores, different evaluation outcomes, different timing of veto). By proving both outcomes work end-to-end, the walking skeletons establish that the authorization gate functions correctly in both directions.

## What They Do NOT Prove

These skeletons intentionally defer:
- Schema validation details (Milestone 1 focused scenarios)
- Veto window timing mechanics -- auto-approve on expiry (Milestone 2)
- Orchestrator session spawning integration (Milestone 2)
- Governance feed rendering and SSE events (Milestone 3)
- SurrealQL EVENT firing mechanics (Milestone 3)
- Error handling -- LLM timeout, fallback (Milestone 3)

## Dependencies and Setup

### Infrastructure
- SurrealDB with `intent` table schema applied
- `triggered_by`, `gates`, `vetoed_by` relation tables defined
- `identity` table for agent/human identity records
- Bun server with intent routes registered

### Test Environment
- Uses `setupOrchestratorSuite` for isolated namespace/database
- Evaluation is simulated (direct DB update) rather than live LLM call
- Veto is simulated via direct DB update until HTTP endpoint is implemented
- Walking skeletons are ENABLED (not skipped) -- they are the first tests to pass

### Implementation Sequence
1. Apply intent schema migration
2. Register intent routes in server
3. Enable walking skeleton 1 -- implement until it passes
4. Enable walking skeleton 2 -- implement until it passes
5. Begin milestone-1 focused scenarios one at a time
