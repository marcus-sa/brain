# Policy Node — Jobs-to-be-Done: Opportunity Scores

## Opportunity Scoring (Importance vs. Satisfaction)

Scale: 1-10 for each dimension.
**Opportunity Score** = Importance + max(Importance - Satisfaction, 0)

| Job | Description | Importance | Current Satisfaction | Opportunity Score | Rank |
|-----|-------------|:----------:|:-------------------:|:-----------------:|:----:|
| **Job 2** | Enforce rules at intent time | **10** | **1** | **19** | 1 |
| **Job 1** | Define governance rules | **9** | **1** | **17** | 2 |
| **Job 4** | Verify policy compliance | **7** | **2** | **12** | 3 |
| **Job 3** | Review policy-flagged intents | **7** | **3** | **11** | 4 |

### Rationale

**Job 2 (Enforce — Score: 19):**
Highest importance because without enforcement, policies are decorative. Current satisfaction is 1/10: `checkPolicyGate()` is a stub that passes `{}` in production. The entire deterministic safety floor is non-functional.

**Job 1 (Define — Score: 17):**
Can't enforce what doesn't exist. The `WorkspacePolicy` type is never persisted to SurrealDB. No CRUD, no versioning, no schema. Importance slightly lower than enforcement because you could theoretically hard-code policies — but that's the exact problem.

**Job 4 (Verify — Score: 12):**
Audit events exist but lack policy context. Important for compliance but secondary to having policies at all. Satisfaction is 2/10 because `audit_event` table captures the event types but no policy references.

**Job 3 (Review — Score: 11):**
Veto window exists and works (`pending_veto` → human approve/veto). Satisfaction is 3/10 because the mechanism works, it just lacks policy context in the evaluation trace. Lowest priority because the human can still make decisions — they just lack structured policy justification.

---

## Implementation Priority

```
Phase 1 (Walking Skeleton):  Job 1 + Job 2
  → policy table + graph relations + replace checkPolicyGate stub

Phase 2 (Governance Feed):   Job 3
  → policy evaluation trace in veto view

Phase 3 (Compliance):        Job 4
  → audit_event ↔ policy version linking
```

The opportunity scores confirm: **build the policy table and wire it into the authorizer first**. Everything else depends on policies existing.
