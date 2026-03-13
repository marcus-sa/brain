# DISCUSS Wave Handoff: Agent Learnings -> DESIGN Wave

## Status: Ready for Handoff
- DoR: All 6 stories PASSED (see dor-validation.md)
- Peer Review: Approved (iteration 2, see peer-review.md)
- All critical/high issues resolved

---

## Package Contents

### JTBD Analysis
| File | Purpose |
|------|---------|
| `docs/ux/agent-learnings/jtbd-analysis.md` | 4 job stories, forces analysis, opportunity scoring, persona definitions, story bridge |

### Journey Artifacts (docs/ux/agent-learnings/)
| File | Journey |
|------|---------|
| `journey-human-creates-learning-visual.md` | Human correction flow with emotional arc, ASCII mockups, collision check, persistence, MCP injection |
| `journey-human-correction.yaml` | Structured schema: 9 steps, artifacts, integration checkpoints |
| `journey-human-creates-learning.feature` | 9 Gherkin scenarios |
| `journey-agent-suggests-learning-visual.md` | Agent suggestion + cross-agent coaching flow |
| `journey-agent-suggests-learning.yaml` | Structured schema: detection, suggestion, feed, approval |
| `journey-agent-suggests-learning.feature` | 11 Gherkin scenarios |
| `journey-collision-detection-visual.md` | Three-layer collision (policy/learning/decision), priority weighting, resolution flows, ASCII mockups |
| `journey-collision-detection.yaml` | Structured schema: collision engine, priority rules, error paths |
| `journey-collision-detection.feature` | 16 Gherkin scenarios (policy hard block, learning warning, decision info, priority weighting, error handling) |
| `journey-governance-review-visual.md` | Feed review + learning library curation |
| `journey-runtime-injection-visual.md` | JIT prompt injection pipeline |
| `journey-runtime-injection.yaml` | Structured schema: query, sort, budget, inject |
| `journey-runtime-injection.feature` | 11 Gherkin scenarios (incl. 2 @property) |
| `shared-artifacts-registry.md` | 10 tracked artifacts with sources, consumers, risk levels, integration checkpoints |

### Requirements (docs/requirements/agent-learnings/)
| File | Story | Priority | Effort |
|------|-------|----------|--------|
| `US-AL-005-learning-schema.md` | Learning Entity Schema | Must Have | 1-2 days |
| `US-AL-001-human-creates-learning.md` | Human Creates Learning | Must Have | 2-3 days |
| `US-AL-003-runtime-injection.md` | JIT Prompt Injection | Must Have | 2 days |
| `US-AL-004-governance-feed-cards.md` | Governance Feed + Library | Should Have | 2-3 days |
| `US-AL-002-agent-suggests-learning.md` | Agent Suggests Learning | Should Have | 2-3 days |
| `US-AL-006-conflict-detection.md` | Conflict Detection | Should Have | 2-3 days |
| `dor-validation.md` | DoR validation for all 6 stories | -- | -- |
| `peer-review.md` | Peer review (2 iterations, approved) | -- | -- |

---

## Recommended Implementation Order

```
Phase 1 (Foundation):
  US-AL-005 (Schema) ─────────────────────────────┐
                                                    │
Phase 2 (Core Value, parallel):                    │
  US-AL-001 (Human Creates) ──┐                    │
  US-AL-003 (Runtime Inject) ─┤── delivers MVP     │
                               │                    │
Phase 3 (Governance):         │                    │
  US-AL-004 (Feed + Library) ─┘                    │
                                                    │
Phase 4 (Self-Improvement):                        │
  US-AL-002 (Agent Suggests) ──────────────────────┘
                               │
Phase 5 (Safety):             │
  US-AL-006 (Conflict Detection) ─────────────────
```

Phase 1+2 deliver the core job: "say it once, agents remember forever."
Phase 3+4 deliver the self-improvement loop: agents suggest, humans approve.
Phase 5 is a safety net for accumulated learnings.

---

## Key Design Decisions for Solution Architect

These are solution-neutral requirements. The DESIGN wave makes technology choices. Key decisions needed:

1. **Learning table design**: New table (recommended, follows observation/suggestion pattern) vs extending suggestion table with a `kind` discriminator
2. **Correction detection data sources** (DECIDED in DISCUSS wave):
   - **Source 1 — Conversation history** (highest value, lowest cost): Chat agent detects corrections in real-time via LLM classification of user messages. Calls `suggest_learning` tool immediately. Evidence: `record<message>`.
   - **Source 2 — Trace table** (cross-session patterns): Observer scans `trace` records for repeated tool failures (same tool + same error pattern across 3+ traces). Evidence: `record<trace>`. Known gap: traces lack structured error fields — Phase 1 uses output text inspection.
   - **Source 3 — Observation escalation** (compound signals): Observer groups open observations by embedding similarity. Clusters of 3+ promote to learning suggestion. Evidence: `record<observation>`.
3. **Token budget strategy**: Hard limit vs soft limit for human learnings. Exact tokenizer vs word-count heuristic.
4. **Conflict detection depth**: Embedding similarity alone vs embedding + LLM intent analysis for contradiction classification
5. **Observer integration**: New scan types in existing Observer loop (trace scan + observation cluster scan) — not a separate scheduled job
6. **Feed card component**: Extend existing suggestion card vs new learning-specific card component

---

## Existing Codebase Integration Points

| Integration Point | File | What Changes |
|-------------------|------|-------------|
| Schema | `schema/migrations/NNNN_add_learning_table.surql` | New migration |
| Chat prompt | `app/src/server/chat/context.ts` | Add learnings to ChatContext, inject in buildSystemPrompt |
| PM prompt | `app/src/server/agents/pm/prompt.ts` | Add learnings section |
| MCP context | `cli/src/context-builder.ts` | Add learnings to context packet |
| Observer context | `app/src/server/agents/observer/context-loader.ts` | Add learnings section |
| Feed queries | `app/src/server/feed/feed-queries.ts` | Add learning feed items |
| Feed route | `app/src/server/feed/feed-route.ts` | Add learning endpoints |
| Shared contracts | `app/src/shared/contracts.ts` | Add LearningSummary type |
| Server routes | `app/src/server/runtime/start-server.ts` | Register learning routes |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Prompt bloat from excessive learnings | Medium | Medium | Token budget with human-override. Observation alert on budget exceed. |
| Low-quality agent suggestions | Medium | Low | Human approval gate. Confidence threshold. Dismissal feedback loop. |
| Conflicting learnings confuse agents | Low | High | Conflict detection at creation. Priority ordering at injection. |
| Learning accumulation without curation | Medium | Medium | Library view with filters. Periodic conflict scan. |
| Performance impact on session startup | Low | Medium | Learning query is simple indexed lookup. Budget cap limits payload size. |

---

## Glossary (Ubiquitous Language)

| Term | Definition |
|------|-----------|
| Learning | A persistent behavioral rule stored in the knowledge graph |
| Active | A learning with status "active" -- injected into agent prompts |
| Pending | A learning with status "pending_approval" -- awaiting human review |
| Constraint | Learning type: must-follow rule ("never do X") |
| Instruction | Learning type: conditional guidance ("when Y, do Z") |
| Precedent | Learning type: historical reference ("in the past, we did A") |
| Superseded | A learning replaced by a newer learning -- preserved in history |
| Deactivated | A learning manually turned off -- not injected but visible in library |
| JIT Prompting | Just-In-Time injection of learnings into system prompts at session start |
| Cross-Agent Coaching | One agent suggesting a learning for a different agent type |
| Learning Library | Curation view showing all learnings with filters and management controls |
