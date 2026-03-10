# Policy Node — Journey: Policy Lifecycle

## Actors

| Actor | Type | Role |
|-------|------|------|
| **Org Admin** | Human | Creates, updates, deprecates policies |
| **Authorizer** | System (intent evaluation pipeline) | Loads and evaluates policies at intent time |
| **Agent** | Machine (code_agent, architect, etc.) | Submits intents that policies govern |
| **Reviewer** | Human | Approves/vetoes policy-flagged intents |
| **Auditor** | Human | Queries policy compliance after the fact |

---

## Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        POLICY LIFECYCLE JOURNEY                                  │
├──────────┬──────────────────────────────┬───────────────┬───────────────────────┤
│  Phase   │  Step                        │  Actor        │  Emotion              │
├──────────┼──────────────────────────────┼───────────────┼───────────────────────┤
│          │                              │               │                       │
│ DEFINE   │ 1. Create policy (draft)     │ Org Admin     │ Deliberate, focused   │
│          │    - title, description       │               │                       │
│          │    - selector (scope)         │               │                       │
│          │    - rules[] (allow/deny)     │               │                       │
│          │    - human_veto_required?     │               │                       │
│          │                              │               │                       │
│          │ 2. Test policy (testing)     │ Org Admin     │ Cautious, verifying   │
│          │    - dry-run against recent  │               │                       │
│          │      intents to check for    │               │                       │
│          │      false positives/negatives│               │                       │
│          │                              │               │                       │
│          │ 3. Activate policy           │ Org Admin     │ Confident             │
│          │    - status → active          │               │                       │
│          │    - RELATE governing edge    │               │                       │
│          │    - RELATE protects edge     │               │                       │
│          │                              │               │                       │
├──────────┼──────────────────────────────┼───────────────┼───────────────────────┤
│          │                              │               │                       │
│ ENFORCE  │ 4. Agent submits intent     │ Agent         │ (machine — no emotion)│
│          │    POST /api/intents/submit  │               │                       │
│          │                              │               │                       │
│          │ 5. Load applicable policies │ Authorizer    │ (machine)             │
│          │    SELECT ->governing->      │               │                       │
│          │      policy FROM $identity   │               │                       │
│          │    + SELECT <-protects<-     │               │                       │
│          │      policy FROM $workspace  │               │                       │
│          │                              │               │                       │
│          │ 6. Evaluate rules            │ Authorizer    │ (machine)             │
│          │    - Sort by priority DESC   │               │                       │
│          │    - First deny → REJECT     │               │                       │
│          │    - All allow → pass gate   │               │                       │
│          │    - human_veto_required?    │               │                       │
│          │      → force veto_window    │               │                       │
│          │                              │               │                       │
│          │ 7. Record evaluation trace  │ Authorizer    │ (machine)             │
│          │    - policy IDs + versions   │               │                       │
│          │    - rules matched           │               │                       │
│          │    - effects applied          │               │                       │
│          │                              │               │                       │
├──────────┼──────────────────────────────┼───────────────┼───────────────────────┤
│          │                              │               │                       │
│ REVIEW   │ 8. View flagged intent      │ Reviewer      │ Informed, not guessing│
│          │    - See policy trace         │               │                       │
│          │    - See which rule flagged   │               │                       │
│          │    - See intent details       │               │                       │
│          │                              │               │                       │
│          │ 9. Approve or veto           │ Reviewer      │ Decisive, accountable │
│          │    - Decision recorded with  │               │                       │
│          │      policy context           │               │                       │
│          │                              │               │                       │
├──────────┼──────────────────────────────┼───────────────┼───────────────────────┤
│          │                              │               │                       │
│ EVOLVE   │ 10. Update policy rules     │ Org Admin     │ Responsive, adapting  │
│          │     - Bump version           │               │                       │
│          │     - Old version immutable  │               │                       │
│          │                              │               │                       │
│          │ 11. Deprecate policy         │ Org Admin     │ Cleaning up           │
│          │     - status → deprecated    │               │                       │
│          │     - REMOVE governing edge  │               │                       │
│          │                              │               │                       │
├──────────┼──────────────────────────────┼───────────────┼───────────────────────┤
│          │                              │               │                       │
│ AUDIT    │ 12. Query compliance        │ Auditor       │ Thorough, verifying   │
│          │     - "Show all intents      │               │                       │
│          │       evaluated under policy │               │                       │
│          │       finance-001 v2026.03"  │               │                       │
│          │     - Trace decision → policy│               │                       │
│          │       version → rules        │               │                       │
│          │                              │               │                       │
└──────────┴──────────────────────────────┴───────────────┴───────────────────────┘
```

---

## Emotional Arc

```
Confidence
    ▲
    │                                          ┌─── 9. Approve (decisive)
    │                              ┌─── 8. See │
    │                    ┌── 6,7.  │   trace   │
    │         ┌── 3.     │ Evaluate│  (informed)│        ┌── 12. Audit
    │    ┌─ 2.│ Activate │ + trace │           │   ┌─ 11│   (verified)
    │  1.│Test│(confident)         │           │ 10│    │
    │ Draft   │                    │           │ Update  │
    │  │      │                    │           │  │      │
    ├──┼──────┼────────────────────┼───────────┼──┼──────┼───────────►
    │  DEFINE          ENFORCE          REVIEW      EVOLVE    AUDIT
    │
    │  Deliberate → Cautious → Confident → Deterministic → Informed → Decisive → Verified
```

The emotional arc builds confidence progressively:
- **Define**: Starts deliberate (drafting rules), builds through testing, reaches confidence at activation
- **Enforce**: Deterministic — no anxiety because rules are structural, not advisory
- **Review**: Informed — reviewer sees policy trace, not raw LLM output
- **Evolve**: Responsive — version bump preserves history, no fear of losing audit trail
- **Audit**: Verified — every decision traceable to a specific policy version

---

## Error Paths

| Step | Error | Recovery |
|------|-------|----------|
| 1 | Invalid rule syntax | Validation at creation time; reject malformed conditions |
| 3 | Conflicting policies (two policies, contradictory rules) | Conflict detection on activation; surface as observation |
| 5 | No policies found for identity+workspace | Default to current behavior (pass-through to LLM) |
| 6 | Rule condition evaluation error | Log error, skip rule, surface as warning observation |
| 10 | Version bump breaks dependent policies | Immutable versions — old version still works until deprecated |
