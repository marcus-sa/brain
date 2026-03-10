# Intent Node -- Opportunity Scores

## Scoring Method

**Opportunity Score** = Importance + max(Importance - Satisfaction, 0)

Scale: 1-10 for each dimension. Higher opportunity score = stronger candidate for investment.

## Scores

| Job | Importance | Current Satisfaction | Opportunity Score | Rank |
|-----|-----------|---------------------|-------------------|------|
| J2: Passive Oversight (Human) | 10 | 2 | 18 | 1 |
| J3: Intent Drift Detection (Judge) | 9 | 1 | 17 | 2 |
| J1: Scoped Authorization (Agent) | 8 | 3 | 13 | 3 |
| J4: Auditable Action History (Org) | 7 | 4 | 10 | 4 |

## Analysis

### J2 ranks highest
Humans currently have zero proactive visibility into agent actions. The existing accept/reject flow is *post-hoc* -- the agent already did the work. Moving to pre-execution awareness with veto power is a massive satisfaction gap.

### J3 close second
No dynamic intent evaluation exists. The `authority_scope` table is static and coarse-grained. An LLM-based judge adds the nuanced evaluation layer needed for real governance.

### J1 important but partially served
Agents already get scoped tool access via `agent-options.ts` (allowed tools array). The gap is *dynamic* scoping based on the specific task, not just the agent type.

### J4 valuable but less urgent
Some traceability exists via `agent_session` records, `produced` relations, and git commits. The gap is connecting these into a coherent authorization chain, not building from scratch.

## Implementation Priority

**Phase 1 (MVP):** J2 + J3 together -- the veto window and authorizer agent are tightly coupled. You can't have meaningful oversight without evaluation, and evaluation without a human feedback loop is pointless.

**Phase 2:** J1 -- once the authorization gate exists, refine how agents request scoped permissions via intent declarations.

**Phase 3:** J4 -- once intents flow through the system, add graph queries for audit trail traversal.
