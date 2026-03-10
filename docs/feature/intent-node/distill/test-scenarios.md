# Intent Node: Test Scenario Mapping

## Scenario Inventory

| # | Test File | Scenario | User Story | Status |
|---|-----------|----------|------------|--------|
| 1 | walking-skeleton | Agent creates low-risk intent, submits, auto-approved | US-1, US-2, US-5, US-6 | enabled |
| 2 | walking-skeleton | Agent creates high-risk intent, human vetoes | US-1, US-2, US-4, US-5 | enabled |
| 3 | milestone-1 | Schema rejects intent with missing required fields | US-1 | skip |
| 4 | milestone-1 | Schema rejects invalid status value | US-1 | skip |
| 5 | milestone-1 | Intent traces back to originating task | US-1 | skip |
| 6 | milestone-1 | Policy gate rejects budget violation | US-5 | skip |
| 7 | milestone-1 | Authorizer approves well-scoped low-risk intent | US-5, US-6 | skip |
| 8 | milestone-1 | Authorizer rejects privilege escalation | US-5 | skip |
| 9 | milestone-1 | Authorizer detects reasoning manipulation | US-5 | skip |
| 10 | milestone-1 | Low-risk auto-approve skips veto window | US-6 | skip |
| 11 | milestone-1 | Medium-risk enters veto window | US-3, US-5 | skip |
| 12 | milestone-1 | Rejection skips veto window entirely | US-5 | skip |
| 13 | milestone-2 | Auto-approve on veto window expiry | US-4 | skip |
| 14 | milestone-2 | Human veto within window stops execution | US-4 | skip |
| 15 | milestone-2 | Veto after execution started aborts session | US-4 | skip |
| 16 | milestone-2 | Orchestrator blocks spawn for unauthorized intent | US-6 | skip |
| 17 | milestone-2 | Orchestrator spawns session on authorized intent | US-6 | skip |
| 18 | milestone-2 | Execution completion updates intent to completed | US-6 | skip |
| 19 | milestone-2 | Execution failure updates intent to failed | US-6 | skip |
| 20 | milestone-3 | High-risk intent appears in governance feed | US-3 | skip |
| 21 | milestone-3 | Full intent chain traceable in graph | US-7 | skip |
| 22 | milestone-3 | SurrealQL EVENT fires on pending_auth transition | US-8 | skip |
| 23 | milestone-3 | Evaluation timeout fails intent with reason | error | skip |
| 24 | milestone-3 | LLM failure falls back to policy-only check | error | skip |

**Total: 24 scenarios** (2 walking skeletons + 10 milestone-1 + 7 milestone-2 + 5 milestone-3)

## Coverage Analysis

### User Story Coverage

| User Story | Scenarios | Coverage |
|------------|-----------|----------|
| US-1: Create Intent | #1, #2, #3, #4, #5 | 5 scenarios |
| US-2: Submit Intent | #1, #2 | 2 scenarios (covered by walking skeletons) |
| US-3: Receive Notification | #11, #20 | 2 scenarios |
| US-4: Veto Intent | #2, #13, #14, #15 | 4 scenarios |
| US-5: Evaluate Intent | #1, #2, #6, #7, #8, #9, #11, #12 | 8 scenarios |
| US-6: Auto-Approve Low-Risk | #1, #7, #10, #16, #17, #18, #19 | 7 scenarios |
| US-7: Trace Intent Chain | #21 | 1 scenario |
| US-8: SurrealQL Event Handler | #22 | 1 scenario |

### Error Path Ratio

- Success/happy path scenarios: 13
- Error/edge/veto scenarios: 11
- Error ratio: **46%** (exceeds 40% target)

Error scenarios: #2 (veto), #3 (missing fields), #4 (invalid status), #6 (budget violation), #8 (privilege escalation), #9 (reasoning manipulation), #12 (rejection), #14 (human veto), #15 (late veto), #23 (timeout), #24 (LLM fallback)

## Walking Skeleton Rationale

The two walking skeletons were chosen to prove the two fundamental authorization outcomes:

1. **Auto-approve path**: Proves an agent can declare intent, submit for evaluation, receive auto-approval, and the intent record correctly transitions through the lifecycle. This is the primary success path.

2. **Veto path**: Proves the system can surface high-risk intents to humans, a human can veto, and the intent is blocked from execution. This is the critical safety mechanism.

Together they validate that the authorization gate works bidirectionally: it lets safe work through and blocks risky work.

## Milestone Ordering Rationale

### Milestone 1: Authorization Pipeline
Must be implemented first because all other milestones depend on intent creation, evaluation, and risk routing. Contains schema enforcement (foundation) and the core evaluation logic.

### Milestone 2: Veto Window and Execution Gate
Depends on Milestone 1 for intent creation and evaluation. Adds the time-based veto window lifecycle and the orchestrator integration that gates agent execution on authorization status.

### Milestone 3: Observability
Depends on Milestones 1 and 2 for the full intent lifecycle. Adds governance feed integration, audit trail queries, and error handling. These are important for production readiness but not for core functionality.
