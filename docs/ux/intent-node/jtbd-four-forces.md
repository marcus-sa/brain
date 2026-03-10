# Intent Node -- Four Forces Analysis

## Job 1: Scoped Authorization (Worker Agent)

```
                    PUSH (frustration)                    PULL (desired future)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ Agents currently get   │            │ Agents declare exactly │
            │ full tool access with  │            │ what they need; get    │
            │ no scoping. Human must │    ──►     │ scoped auth back.      │
            │ trust blindly or block │            │ Routine actions flow   │
            │ everything.            │            │ without human touch.   │
            └────────────────────────┘            └────────────────────────┘

                   ANXIETY (adoption)                   HABIT (current behavior)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ Extra step before      │            │ Agents just execute    │
            │ execution = latency.   │            │ directly via Claude    │
            │ Will the Judge block   │            │ SDK with full allowed  │
            │ legitimate actions?    │            │ tools array. No gate.  │
            └────────────────────────┘            └────────────────────────┘
```

**Key tension**: The authorization gate adds latency. If the Judge is too aggressive, agents stall. If too lenient, governance is theater. The veto window duration and auto-approve threshold are critical tuning knobs.

---

## Job 2: Passive Oversight (Human Operator)

```
                    PUSH (frustration)                    PULL (desired future)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ No visibility into     │            │ See a feed of pending  │
            │ what agents are doing  │            │ intents with risk      │
            │ until after the fact.  │    ──►     │ scores. Veto only the  │
            │ "What did it spend     │            │ dangerous ones. Rest   │
            │  money on?"            │            │ auto-approve.          │
            └────────────────────────┘            └────────────────────────┘

                   ANXIETY (adoption)                   HABIT (current behavior)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ "Will I miss a veto    │            │ Review agent output    │
            │  window and something  │            │ after completion via   │
            │  bad happens?" FOMO    │            │ PR review / session    │
            │  on high-stakes items. │            │ accept/reject flow.    │
            └────────────────────────┘            └────────────────────────┘
```

**Key tension**: Passive notification works for low-risk items but creates anxiety for high-stakes actions. Need risk-based escalation: low-risk auto-approves, high-risk demands active acknowledgment.

---

## Job 3: Intent Drift Detection (Authorizer Agent)

```
                    PUSH (frustration)                    PULL (desired future)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ No mechanism to detect │            │ Every intent evaluated │
            │ privilege escalation.  │    ──►     │ against least-privilege│
            │ An agent asking for    │            │ principle. Drift caught│
            │ full_repo_access to    │            │ before execution, not  │
            │ read a README.         │            │ after damage.          │
            └────────────────────────┘            └────────────────────────┘

                   ANXIETY (adoption)                   HABIT (current behavior)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ LLM-based evaluation   │            │ Static authority_scope │
            │ is non-deterministic.  │            │ table maps agent_type  │
            │ Could approve a bad    │            │ to hardcoded actions.  │
            │ intent or block a good │            │ No dynamic evaluation. │
            │ one.                   │            │                        │
            └────────────────────────┘            └────────────────────────┘
```

**Key tension**: LLM evaluation introduces non-determinism. Mitigate with hard policy rules (budget caps, action allowlists) as first gate, LLM evaluation as second gate for nuanced cases.

---

## Job 4: Auditable Action History (Organization)

```
                    PUSH (frustration)                    PULL (desired future)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ Agent actions scattered│            │ Intent graph = flight  │
            │ across session logs,   │    ──►     │ recorder. Traverse     │
            │ git commits, DB writes.│            │ goal → intent → auth → │
            │ No unified audit trail.│            │ execution → result.    │
            └────────────────────────┘            └────────────────────────┘

                   ANXIETY (adoption)                   HABIT (current behavior)
            ┌────────────────────────┐            ┌────────────────────────┐
            │ Graph bloat from       │            │ Agent sessions tracked │
            │ logging every intent.  │            │ but no explicit intent │
            │ Storage and query      │            │ or authorization chain.│
            │ performance concerns.  │            │                        │
            └────────────────────────┘            └────────────────────────┘
```

**Key tension**: Traceability requires recording every intent, but most are routine. Use intent expiry + archival strategy to manage graph size.
