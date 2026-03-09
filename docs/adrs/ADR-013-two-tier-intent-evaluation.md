# ADR-013: Two-Tier Intent Evaluation (Policy + LLM)

## Status

Proposed

## Context

Intent evaluation must determine whether an agent's requested action is appropriate. LLM-based evaluation provides nuanced reasoning analysis but is non-deterministic and adds latency. Hard policy rules are deterministic and fast but cannot evaluate reasoning quality or detect subtle privilege escalation.

## Decision

Use a two-tier evaluation pipeline:

1. **Tier 1 -- Policy Gate (deterministic, <1ms)**: Check budget limits against action_spec implied cost, validate action against workspace action allowlist, verify requester identity has `create_intent` permission. If policy fails, short-circuit to REJECT without LLM call.

2. **Tier 2 -- LLM Evaluation (non-deterministic, 2-10s)**: If policy passes, invoke Haiku with structured output to evaluate least-privilege alignment (action_spec scope vs stated goal), reasoning quality (coherent chain of thought), and prompt injection detection. Returns `{ decision, risk_score, reason }`.

**Fallback**: If the LLM call fails (timeout, API error), use policy-only result. If policy passed, route to veto window (conservative: human reviews). If policy failed, reject.

## Alternatives Considered

### Alternative 1: LLM-only evaluation

Skip policy tier; let the LLM handle all evaluation including budget checks.

- **Pros**: Single evaluation path, LLM can handle nuanced budget reasoning
- **Why rejected**: LLM is non-deterministic for arithmetic (budget check) and slower. Hard budget limits should never depend on LLM interpretation. Policy rules provide a deterministic safety floor.

### Alternative 2: Policy-only evaluation (no LLM)

Use only deterministic rules: budget range checks, action allowlists, requester permissions.

- **Pros**: Deterministic, fast, no LLM cost
- **Why rejected**: Cannot detect privilege escalation (asking for `full_repo_access` to read a README), reasoning manipulation, or goal-action misalignment. These require semantic understanding that rules cannot provide.

### Alternative 3: Ensemble of multiple LLM evaluators

Run 2-3 LLM evaluations in parallel, take consensus or highest risk score.

- **Pros**: Reduces non-determinism, more robust evaluation
- **Why rejected**: 2-3x LLM cost and latency. For a solo-dev project, the complexity and cost are not justified. Single LLM + policy floor is sufficient for initial deployment. Can upgrade to ensemble if non-determinism proves problematic in production.

## Consequences

### Positive

- Deterministic safety floor: budget violations and unauthorized actions are always caught regardless of LLM behavior
- Fast rejection: policy failures short-circuit without LLM latency
- Graceful degradation: LLM failures fall back to policy + human review (veto window)
- Cost-efficient: Haiku is cheapest tier; policy gate prevents unnecessary LLM calls

### Negative

- Two evaluation paths increase testing surface
- Policy rules must be maintained alongside LLM prompt (dual source of authorization logic)
- risk_score threshold (30) is initially arbitrary; requires production calibration
