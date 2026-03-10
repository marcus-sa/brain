# Intent Node -- Definition of Ready Checklist

## DoR Validation

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **User value articulated** | PASS | 4 JTBD job stories with functional/emotional/social dimensions (`jtbd-job-stories.md`) |
| 2 | **Acceptance criteria testable** | PASS | 25 Gherkin scenarios covering all stories (`acceptance-criteria.md`, `journey-intent-lifecycle.feature`) |
| 3 | **Dependencies identified** | PASS | Existing: identity system, authority_scope, event bridge, SSE registry, orchestrator session lifecycle. New: SurrealQL event handler (http::post), Authorizer Agent LLM endpoint |
| 4 | **Scope bounded** | PASS | Phase 1 (MVP): US-1 through US-6, US-8. Phase 2: US-7 (audit trail). Explicit exclusions: OAuth/DPoP (future), multi-workspace intent routing |
| 5 | **Technical feasibility confirmed** | PASS | SurrealQL EVENT + http::post documented. Existing orchestrator pattern proven. authority_scope extensible. |
| 6 | **Shared artifacts documented** | PASS | 12 artifacts with source, producer, consumer, persistence (`shared-artifacts-registry.md`) |
| 7 | **Error paths defined** | PASS | 4 error paths: judge timeout, judge LLM failure, veto-after-execution race, budget violation (`journey-intent-lifecycle.yaml`) |
| 8 | **Emotional arc coherent** | PASS | Confidence builds: draft (hopeful) -> evaluation (waiting) -> veto window (uncertainty) -> authorized (relief/momentum). Vetoed path has actionable feedback. (`journey-intent-lifecycle-visual.md`) |

## Result: READY for DESIGN wave

All 8 DoR criteria pass. The feature is grounded in JTBD analysis, has comprehensive Gherkin scenarios, leverages existing infrastructure (identity, authority_scope, event bridge, orchestrator), and introduces two new components (SurrealQL event handler, Authorizer Agent endpoint).

## Key Risks for DESIGN

1. **SurrealQL EVENT + http::post reliability** -- event handler is fire-and-forget; need retry/dead-letter strategy
2. **Authorizer Agent non-determinism** -- LLM evaluation may vary; hard policy rules as first gate mitigate this
3. **Veto window race condition** -- human vetoes after execution starts; need abort + incident logging
4. **risk_score threshold tuning** -- 30 is arbitrary; needs real-world calibration

## Handoff Artifacts

```
docs/ux/intent-node/
  jtbd-job-stories.md           -- 4 job stories with dimensions
  jtbd-four-forces.md           -- Push/pull/anxiety/habit per job
  jtbd-opportunity-scores.md    -- Ranked opportunity scores
  journey-intent-lifecycle-visual.md  -- Visual journey + emotional arc
  journey-intent-lifecycle.yaml       -- Machine-readable journey schema
  journey-intent-lifecycle.feature    -- 14 Gherkin scenarios
  shared-artifacts-registry.md        -- 12 shared artifacts + 5 graph relations

docs/requirements/
  requirements.md               -- FR (8) + NFR (3) + TR (3)
  user-stories.md               -- 8 user stories with traceability
  acceptance-criteria.md        -- 25 Gherkin acceptance scenarios
  dor-checklist.md              -- This file
```
