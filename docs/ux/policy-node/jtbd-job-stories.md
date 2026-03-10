# Policy Node — Jobs-to-be-Done: Job Stories

## Job 1: Define Governance Rules (Org Admin)

**When** I'm setting up a workspace for autonomous agents to operate in,
**I want to** define clear, machine-enforceable rules about what agents can and cannot do,
**So I can** trust that agents will stay within boundaries without me watching every action.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Create structured policy rules (budget caps, action allowlists, deny rules) that the authorizer evaluates deterministically |
| **Emotional** | Feel confident that the system has guardrails — "I set the rules, and they're enforced" |
| **Social** | Be seen as responsible by stakeholders — "We have governance, not just vibes" |

---

## Job 2: Enforce Rules at Intent Time (Authorizer Agent)

**When** an agent submits an intent requesting to perform an action,
**I want to** traverse all applicable policies for that agent's identity and workspace,
**So I can** deterministically permit or deny the intent before any LLM evaluation runs.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Load policies from DB, match selectors, evaluate rules in priority order, short-circuit on deny |
| **Emotional** | N/A (machine actor) — but the human trusts that enforcement is architectural, not advisory |
| **Social** | N/A (machine actor) |

---

## Job 3: Review Policy-Flagged Intents (Human Reviewer)

**When** an intent triggers a `human_veto_required` policy or lands in the veto window,
**I want to** see exactly which policy rules were evaluated, which passed, and which flagged the intent,
**So I can** make an informed approve/veto decision quickly without re-reading the raw intent.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | View policy evaluation trace (rules matched, effects applied, final disposition) alongside the intent details |
| **Emotional** | Feel informed, not overwhelmed — "I know exactly why this needs my attention" |
| **Social** | Demonstrate due diligence — "I reviewed it against our stated policies" |

---

## Job 4: Verify Policy Compliance (Auditor)

**When** I need to understand why a past intent was approved or rejected,
**I want to** trace the decision back to the specific policy version and rules that were active at the time,
**So I can** prove compliance and identify policy gaps.

### Job Dimensions

| Dimension | Description |
|-----------|-------------|
| **Functional** | Query audit_events joined with policy version snapshots to reconstruct the evaluation context |
| **Emotional** | Feel assured that the audit trail is complete — "Every decision is traceable to a policy" |
| **Social** | Satisfy external audit requirements — "Here's the governance record" |

---

## JTBD-to-Story Bridge

| Job | Primary User Stories |
|-----|---------------------|
| Job 1 (Define Rules) | US-1 (Create policy), US-2 (Policy lifecycle), US-3 (Selector scoping) |
| Job 2 (Enforce Rules) | US-4 (Policy gate traversal), US-5 (Rule evaluation), US-6 (Deny short-circuit) |
| Job 3 (Review Flagged) | US-7 (Policy trace in veto view), US-8 (Human veto gate) |
| Job 4 (Verify Compliance) | US-9 (Audit trail with policy version), US-10 (Policy change history) |
