# Peer Review: Agent Learnings Requirements Package

```yaml
review_id: "req_rev_20260313_001"
reviewer: "product-owner (review mode)"
artifact: "docs/requirements/agent-learnings/"
iteration: 1

strengths:
  - "All 6 stories trace to specific JTBD job stories with explicit job numbers"
  - "Real persona (Tomas Eriksson) with specific context used throughout -- no generic 'user' references"
  - "Domain examples use realistic data: actual SurrealDB conventions (null vs undefined, KNN bug, RecordId patterns) grounded in the codebase"
  - "Four Forces analysis identifies real adoption blockers (anxiety about permanence, habit of CLAUDE.md files)"
  - "Opportunity scoring provides evidence-based prioritization, not gut feel"
  - "Schema story (US-AL-005) correctly identifies existing entity patterns (observation, suggestion) as templates"
  - "Emotional arcs map naturally to the Problem Relief and Confidence Building patterns"
  - "Shared artifacts registry tracks 10 artifacts with sources, consumers, and integration risk levels"

issues_identified:
  confirmation_bias:
    - issue: "No consideration of alternative approaches to learning persistence (e.g., learning as a subtype of existing suggestion entity rather than new table)"
      severity: "medium"
      location: "US-AL-005"
      recommendation: "Add a brief note acknowledging the design choice (new table vs extending suggestion) and why -- this is acceptable as a DISCUSS wave artifact since DESIGN wave makes the final call"

  completeness_gaps:
    - issue: "Missing: learning deactivation flow. Stories mention 'deactivated' status but no UAT scenario covers how a user deactivates a learning."
      severity: "high"
      location: "US-AL-001, US-AL-004"
      recommendation: "Add scenario to US-AL-004: 'Given Tomas views the learning library When he clicks Deactivate on an active learning Then status changes to deactivated and learning is no longer injected.' This is within existing story scope."
    - issue: "Missing: learning library view as a standalone route. Journey visual shows it but no story owns the library page/component."
      severity: "high"
      location: "US-AL-004"
      recommendation: "US-AL-004 scope should explicitly include the learning library view (list with filters). Add AC: 'Learning library view accessible showing all learnings with filter by status, agent, type.' This keeps it one story since library is a simple filtered list."
    - issue: "Missing: how agents reference learnings in their output. Journey visual shows agent saying 'Following workspace convention...' but no AC covers this."
      severity: "medium"
      location: "US-AL-003"
      recommendation: "This is a nice-to-have, not core. Note it as a future enhancement rather than adding to current scope."

  clarity_issues:
    - issue: "Token budget of '~500 tokens' is vague. Should specify whether this is configurable or hardcoded."
      severity: "medium"
      location: "US-AL-003"
      recommendation: "Clarify: 'Token budget defaults to 500 tokens, configurable per workspace.' Add to technical notes."
    - issue: "Correction pattern detection threshold (3 occurrences in 14 days) -- unclear if these are from the same user or any user"
      severity: "medium"
      location: "US-AL-001, US-AL-002"
      recommendation: "Clarify: corrections from any user in the workspace count toward the threshold."

  testability_concerns:
    - issue: "Intent analysis for conflict detection (complementary vs contradictory) requires LLM call -- non-deterministic"
      severity: "medium"
      location: "US-AL-006"
      recommendation: "Tag intent analysis scenarios with @property to indicate they test a probabilistic quality. Add: 'Intent analysis correctly classifies at least 80% of known contradiction pairs.'"

  priority_validation:
    q1_largest_bottleneck: "YES"
    q2_simple_alternatives: "ADEQUATE"
    q3_constraint_prioritization: "CORRECT"
    q4_data_justified: "JUSTIFIED"
    verdict: "PASS"

approval_status: "conditionally_approved"
critical_issues_count: 0
high_issues_count: 2
```

## Remediation Actions

### HIGH-1: Add deactivation scenario to US-AL-004
Add to US-AL-004 UAT:
```gherkin
Scenario: Deactivate an active learning
  Given Tomas views the learning library with 8 active learnings
  When he clicks "Deactivate" on the learning "Billing uses integer cents"
  Then a confirmation prompt appears "Deactivate this learning? It will no longer be injected into agent prompts."
  When Tomas confirms
  Then the learning status changes to "deactivated"
  And deactivated_at and deactivated_by are recorded
  And the learning is no longer returned by prompt injection queries
  And the learning remains visible in the library with "deactivated" badge
```

Add to US-AL-004 AC:
- [ ] Deactivation changes status to "deactivated" with confirmation prompt
- [ ] Deactivated learnings remain visible in library but are not injected

### HIGH-2: Add learning library view to US-AL-004 scope
Add to US-AL-004 AC:
- [ ] Learning library view accessible from governance feed and navigation
- [ ] Library shows all learnings with filters: status (active/pending/superseded/deactivated/dismissed), agent type, learning type
- [ ] Each learning card shows text, type, source, status, target agents, created date

## Iteration 1 Verdict
**Conditionally approved** pending HIGH-1 and HIGH-2 remediation. No critical issues. Medium issues are noted for awareness but do not block handoff.

---

## Iteration 2: Post-Remediation

HIGH-1 (deactivation scenario) and HIGH-2 (learning library view) have been remediated in US-AL-004:
- Added scenario "Deactivate an active learning from library" with confirmation prompt and status tracking
- Added scenario "Learning library view with filters" with status/agent/type filters
- Added 4 new AC items covering library view, filters, card display, and deactivation flow

All 6 stories now pass DoR. No critical or high issues remain.

**Iteration 2 Verdict**: **Approved**. Package ready for handoff to DESIGN wave.
