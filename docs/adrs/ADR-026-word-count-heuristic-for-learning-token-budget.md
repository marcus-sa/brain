# ADR-026: Word-Count Heuristic for Learning Token Budget

## Status
Proposed

## Context
Agent learnings are injected into system prompts with a ~500 token budget. We need a mechanism to estimate token count for budget enforcement. Two approaches: exact tokenizer library (tiktoken) or word-count heuristic.

The budget is soft -- exceeding by 50-100 tokens has no functional impact. Constraints are never dropped regardless of budget. The injection happens once per session start, not per message.

## Decision
Use word-count heuristic: 1 word ~= 1.33 tokens. Budget of ~500 tokens translates to ~375 words.

### Token Estimation Algorithm

`estimateTokens(text)`: split on whitespace, count words, divide by 0.75, ceiling.

```
estimateTokens(text: string): number
  words = text.trim().split(/\s+/).length
  return Math.ceil(words / 0.75)
```

### Budget Enforcement Rules

1. Compute constraint tokens: sum `estimateTokens(text)` for all constraint learnings
2. If constraint tokens alone exceed 500: include ALL constraints anyway, log an observation "Workspace learning constraints exceed token budget ({N} tokens)", set remaining budget to 0
3. Remaining budget = 500 - constraint tokens
4. Fill with instructions in priority order (human first, then high > medium > low, then newest) until next instruction would exceed remaining budget -- skip it, try next
5. If `contextEmbedding` provided: fill remaining budget with precedents sorted by similarity descending (> 0.70 threshold)
6. Constraints are NEVER dropped. Instructions and precedents are best-effort within budget.

## Alternatives Considered

### tiktoken WASM library
- **What**: Exact BPE tokenizer matching OpenAI/Anthropic token counting
- **Why rejected**: Adds ~2MB WASM dependency. Precision not needed for a soft prompt budget. Different models use different tokenizers anyway, so "exact" is model-dependent. Overhead unjustified for a non-critical budget.

### Character-count heuristic
- **What**: 1 token ~= 4 characters
- **Why rejected**: Less accurate than word-count for English text with technical terms. Word boundaries align better with subword tokenization patterns.

## Consequences
- **Positive**: Zero dependency. Fast computation. Good enough for soft budget (~10% variance acceptable).
- **Negative**: May over/under-estimate by ~10-15% for code-heavy or symbol-heavy learning text. Acceptable given constraints are exempt from budget.
