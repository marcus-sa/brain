# Policy Node — Acceptance Criteria

## AC-1: Create Policy Record (US-1)

```gherkin
Given a SurrealDB instance with the policy schema applied
When I CREATE a policy with title "Finance Small Spend", status "draft",
  selector { resource: "banking_api" },
  rules [{ id: "max_spend", condition: { field: "budget_limit.amount", operator: "lte", value: 500 }, effect: "allow", priority: 1 }],
  human_veto_required false,
  max_ttl "1h"
Then the record is persisted with all fields
And version is "1"
And created_at is set
And status is "draft"
```

```gherkin
Given a policy CREATE with effect "invalid"
Then the CREATE fails with ASSERT violation on rules[*].effect
```

```gherkin
Given a policy CREATE with status "invalid"
Then the CREATE fails with ASSERT violation on status
```

---

## AC-2: Policy Lifecycle Management (US-2)

```gherkin
Given a draft policy
When I UPDATE status to "active"
Then the status becomes "active"
And an audit_event with event_type "policy_activated" is created
```

```gherkin
Given an active policy
When I UPDATE status to "deprecated"
Then the status becomes "deprecated"
And all governing edges FROM any identity TO this policy are removed
And all protects edges FROM this policy TO any workspace are removed
And an audit_event with event_type "policy_deprecated" is created
```

---

## AC-3: Graph Relations (US-3)

```gherkin
Given an active policy and an identity in workspace "acme"
When I RELATE identity->governing->policy
Then the edge is created with created_at
And SELECT ->governing->policy FROM identity returns the policy
```

```gherkin
Given an active policy and workspace "acme"
When I RELATE policy->protects->workspace
Then the edge is created with created_at
And SELECT <-protects<-policy FROM workspace returns the policy
```

---

## AC-4: Policy Gate Graph Traversal (US-4)

```gherkin
Given identity "agent-1" with governing edge to policy "p1"
And workspace "acme" with protects edge from policy "p2"
And both policies have status "active"
When the authorizer loads policies for identity "agent-1" in workspace "acme"
Then both policies "p1" and "p2" are returned
And deprecated policies are excluded
```

```gherkin
Given identity "agent-1" with governing edge to policy "p1" (status "deprecated")
When the authorizer loads policies for identity "agent-1"
Then policy "p1" is NOT returned
```

---

## AC-5: Rule Evaluation Engine (US-5)

```gherkin
Given policies with rules:
  | policy | rule_id      | effect | priority | condition                                                          |
  | p1     | block_deploy | deny   | 100      | { field: "action_spec.action", operator: "eq", value: "deploy" }   |
  | p2     | allow_read   | allow  | 10       | { field: "action_spec.action", operator: "eq", value: "read" }     |
When evaluating an intent with action_spec.action = "deploy"
Then the deny rule at priority 100 matches first
And the policy gate returns { passed: false, reason: "block_deploy" }
And the allow rule is never evaluated (short-circuit)
```

```gherkin
Given policies with only allow rules
When evaluating an intent that matches an allow rule
Then the policy gate returns { passed: true }
And the evaluation trace records all rules as { matched: true/false }
```

```gherkin
Given policies with rules where no rule condition matches the intent
Then the policy gate returns { passed: true } (no deny = pass)
```

---

## AC-6: Human Veto Gate (US-6)

```gherkin
Given an active policy with human_veto_required = true
And the policy gate passes (no deny rules triggered)
And the LLM evaluator returns risk_score = 10 (normally auto_approve)
When the risk router runs
Then the intent routes to "veto_window" instead of "auto_approve"
Because the policy forces human review
```

---

## AC-7: Policy Evaluation Trace (US-7)

```gherkin
Given an intent evaluated against 2 policies with 3 rules total
When the evaluation completes
Then intent.evaluation.policy_trace contains 3 entries
And each entry has: policy_id, policy_version, rule_id, effect, matched, priority
```

```gherkin
Given a pending_veto intent with policy_trace
When a reviewer queries the intent
Then the policy_trace is included in the response
And policy_trace persists IDs only (policy_id, policy_version, rule_id, effect, matched, priority)
And policy titles are loaded via join at display time (not denormalized into trace)
```

---

## AC-8: Audit Event Extensions (US-8)

```gherkin
Given policy lifecycle events (create, activate, update, deprecate)
Then each event produces an audit_event with:
  - event_type matching the lifecycle action
  - payload containing policy_id and policy_version
  - actor = the identity who performed the action
```

```gherkin
Given an intent evaluated with policy trace
Then the audit_event "intent_evaluated" payload includes policy_trace
```

---

## AC-9: Backward Compatibility (US-9)

```gherkin
Given no active policies for identity "agent-1" in workspace "acme"
When the authorizer evaluates an intent
Then the policy gate returns { passed: true }
And the evaluation proceeds to LLM tier as before
And no policy_trace is recorded (empty array)
```

---

## AC-10: Policy Version Immutability (US-10)

```gherkin
Given an active policy at version "1"
When the org admin updates the rules
Then a new policy record is created with version "2" and status "active"
And the original policy version "1" transitions to status "superseded"
And the original policy's rules, selector, and flags are unchanged
And audit references to version "1" still resolve correctly
```

---

## AC-11: Rule Condition Error Handling (US-5)

```gherkin
Given a policy with rule condition { field: "nonexistent.field", operator: "eq", value: "x" }
When evaluating an intent that does not have "nonexistent.field"
Then the predicate returns false (non-matching)
And the rule is treated as not matched
And intent evaluation continues with remaining rules
And a warning observation is created describing the missing field
```

```gherkin
Given a policy with a malformed condition (invalid operator, missing field)
When the policy is created or updated
Then the operation fails with a validation error
And no policy record is persisted
```

---

## AC-12: Policy Authorization Model (US-8, FR-8)

```gherkin
Given an identity with type "human" that is member_of workspace "acme"
When they create a policy in workspace "acme"
Then the policy is created successfully
```

```gherkin
Given an identity with type "agent" in workspace "acme"
When they attempt to create a policy
Then the request is rejected with 403 Forbidden
```

```gherkin
Given a policy created_by identity "admin-1"
When identity "admin-2" (human, member_of workspace) attempts to activate it
Then the activation succeeds (any human workspace member can activate)
```
