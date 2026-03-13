# ADR-028: Three-Layer Collision Detection for Learnings

## Status
Proposed

## Context
Before a learning becomes active, the system must detect conflicts with existing learnings, policies, and decisions. The question is how deep to make collision detection: embedding similarity alone, embedding + LLM intent analysis, or a multi-layer approach with different thresholds per entity type.

## Decision
Three-layer collision detection with escalating severity and a unified classification algorithm.

### Unified Classification Algorithm

```
Layer 1: Learning-vs-learning
  similarity > 0.90  -> "duplicates" (near-identical, offer merge/supersede)
  similarity 0.75-0.90 -> invoke LLM intent classification:
    LLM returns "contradicts" -> collision warning (yellow, user can override)
    LLM returns "reinforces"  -> informational note (blue, no action needed)
    LLM returns "unrelated"   -> no collision (false positive from embedding)
  similarity < 0.75  -> no collision

Layer 2: Learning-vs-policy
  similarity > 0.80  -> invoke LLM intent classification:
    LLM returns "contradicts" -> hard block (policy outranks learning)
    LLM returns "reinforces"  -> informational note
    LLM returns "unrelated"   -> no collision
  similarity < 0.80  -> no collision

Layer 3: Learning-vs-decision
  similarity > 0.80  -> invoke LLM intent classification:
    LLM returns "contradicts" -> informational warning (decisions inform, don't block)
    LLM returns "reinforces"  -> informational note
    LLM returns "unrelated"   -> no collision
  similarity < 0.80  -> no collision
```

### LLM Intent Classification

**Structured output schema**:
```
{
  classification: "contradicts" | "reinforces" | "unrelated",
  reasoning: string
}
```

**Prompt template** (used with extraction model via `generateObject`):
```
Compare these two behavioral rules and classify their relationship.

Rule A (new learning being activated):
"{new_learning_text}"

Rule B (existing {target_kind}):
"{existing_text}"

Classify as:
- "contradicts": Rules give opposing instructions. Following both is impossible or harmful.
- "reinforces": Rules are compatible and support the same intent, even if worded differently.
- "unrelated": Rules address different topics despite textual similarity.

Return classification and brief reasoning.
```

**Fallback behavior**: If LLM is unavailable (timeout, error), default to `"contradicts"`. This is the safer path -- surfaces a warning to the human rather than silently missing a conflict. The human can dismiss the false positive.

**Latency**: Single `generateObject` call per candidate pair. Expected <2s per call. Bounded by candidate count (max 10 per layer from KNN LIMIT).

## Alternatives Considered

### Embedding similarity only (no LLM)
- **What**: Pure vector similarity with fixed thresholds. Above 0.90 = duplicate, 0.75-0.90 = potential conflict, below 0.75 = no collision.
- **Why rejected**: Embedding similarity cannot distinguish "always use PostgreSQL" from "never use PostgreSQL" -- both have high similarity despite being contradictions. Intent analysis is needed for the ambiguous zone.

### Full LLM analysis for every collision check
- **What**: Run LLM classification on every pair above 0.75 similarity.
- **Why rejected**: Excessive LLM calls for a write-path operation. Most collisions are clear duplicates (>0.90) or clear non-collisions (<0.75). LLM is only needed for the ambiguous middle zone.

## Consequences
- **Positive**: Policy collisions are hard-blocked (safety). LLM cost is bounded to ambiguous cases only. Human-created learnings fail-open when embedding service unavailable (usability). Priority hierarchy is clear: policy > learning, human > agent.
- **Negative**: LLM latency on the write path for ambiguous cases (acceptable -- learning creation is infrequent, not a hot path). False positives possible in the 0.75-0.80 similarity range (mitigated by human review).
