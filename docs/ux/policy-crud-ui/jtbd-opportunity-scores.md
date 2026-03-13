# Policy CRUD UI -- Jobs-to-be-Done: Opportunity Scores

## Opportunity Scoring (Importance vs. Satisfaction)

Scale: 1-10 for each dimension.
**Opportunity Score** = Importance + max(Importance - Satisfaction, 0)

| Job | Description | Importance | Current Satisfaction | Opportunity Score | Rank |
|-----|-------------|:----------:|:-------------------:|:-----------------:|:----:|
| **Job 1** | Define governance rules via UI | **9** | **1** | **17** | 1 |
| **Job 2** | Manage policy lifecycle | **8** | **2** | **14** | 2 |
| **Job 3** | Understand intent evaluation against policies | **8** | **3** | **13** | 3 |
| **Job 4** | Verify policy compliance over time | **7** | **2** | **12** | 4 |

### Rationale

**Job 1 (Define Rules -- Score: 17):**
Highest importance because without a creation interface, the entire policy system is developer-only. The backend exists (`createPolicy()` in `policy-queries.ts`) but has no HTTP endpoint and no UI. Satisfaction is 1/10: only acceptance test helpers can create policies. An org admin has zero self-service capability.

**Job 2 (Manage Lifecycle -- Score: 14):**
`activatePolicy()` and `deprecatePolicy()` exist as internal functions. No HTTP routes, no UI, no version management. Satisfaction is 2/10 because the functions work but require direct server access. Importance is high because policies are useless if they can't transition from draft to active.

**Job 3 (Understand Evaluation -- Score: 13):**
`PolicyTraceEntry[]` is already persisted on `intent.evaluation.policy_trace` by the authorizer pipeline. The data exists but the consent/veto UI doesn't render it. Satisfaction is 3/10 because the veto screen works but lacks policy context. Importance is high because uninformed reviewers either over-approve (risk) or over-veto (agent paralysis).

**Job 4 (Verify Compliance -- Score: 12):**
`createPolicyAuditEvent()` logs lifecycle events but no UI surfaces them. Version comparison requires raw database queries. Satisfaction is 2/10 because audit events exist but are not browsable. Importance is moderate -- compliance is a trailing concern, needed after policies are actively managed.

---

## Outcome Statements (Ranked by Opportunity Score)

### Job 1 Outcomes (Score: 17)

| # | Outcome Statement | Imp. | Sat. | Score |
|---|-------------------|:----:|:----:|:-----:|
| 1.1 | Minimize the time for a non-developer to create a governance policy | 95% | 5% | 18.0 |
| 1.2 | Minimize the likelihood of creating an invalid rule predicate | 90% | 10% | 17.1 |
| 1.3 | Minimize the likelihood of creating a policy that conflicts with existing ones | 85% | 10% | 16.0 |
| 1.4 | Minimize the steps to reach a working draft policy from scratch | 80% | 15% | 14.5 |

### Job 2 Outcomes (Score: 14)

| # | Outcome Statement | Imp. | Sat. | Score |
|---|-------------------|:----:|:----:|:-----:|
| 2.1 | Minimize the time to transition a policy from draft to active | 90% | 15% | 16.5 |
| 2.2 | Minimize the likelihood of activating a policy without understanding its impact | 85% | 10% | 16.0 |
| 2.3 | Minimize the effort to create a new version from an existing policy | 80% | 5% | 15.5 |
| 2.4 | Minimize the uncertainty about which policy version is currently active | 75% | 20% | 13.0 |

### Job 3 Outcomes (Score: 13)

| # | Outcome Statement | Imp. | Sat. | Score |
|---|-------------------|:----:|:----:|:-----:|
| 3.1 | Minimize the time to understand why an intent was flagged by policy | 90% | 25% | 15.5 |
| 3.2 | Minimize the likelihood of approving a policy-denied intent without understanding the rule | 85% | 20% | 14.8 |
| 3.3 | Minimize the steps to navigate from a policy trace to the source policy | 75% | 5% | 14.5 |

### Job 4 Outcomes (Score: 12)

| # | Outcome Statement | Imp. | Sat. | Score |
|---|-------------------|:----:|:----:|:-----:|
| 4.1 | Minimize the time to determine which policy version was active at a given date | 80% | 10% | 15.0 |
| 4.2 | Minimize the effort to compare two policy versions | 75% | 5% | 14.5 |
| 4.3 | Minimize the likelihood of compliance gaps (periods with no active policy) | 70% | 15% | 12.5 |

---

## Implementation Priority

```
Phase 1 (Must Have):     Job 1 + Job 2 (core CRUD + lifecycle)
  -> API endpoints + policy list + create form + rule builder + activate/deprecate

Phase 2 (Should Have):   Job 3 (evaluation trace in review UI)
  -> Policy trace rendering in intent veto/consent screen

Phase 3 (Should Have):   Job 4 (compliance audit)
  -> Version history timeline + version diff + policy detail view
```

### Data Quality Notes
- Source: codebase analysis + domain expertise (no user interviews conducted)
- Sample size: team estimate based on current system capabilities
- Confidence: Medium (team estimates, not user survey data)
- Recommendation: Re-score after first users interact with policy management UI
