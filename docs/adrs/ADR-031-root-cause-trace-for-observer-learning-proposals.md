# ADR-031: Root Cause Trace for Observer Learning Proposals

## Status
Proposed

## Context
The Observer agent detects patterns (repeated contradictions, observation clusters, anomalies) but can only express them as observations. US-AL-002 specifies three data sources for learning suggestions, with the Observer responsible for trace-based detection and observation escalation. The question is whether the Observer should suggest learnings based on **frequency alone** (3 occurrences = suggest) or **diagnostic reasoning** (classify the root cause, propose a categorized fix).

## Decision
Diagnostic reasoning via LLM-based root cause classification. The Observer runs a "Root Cause Trace" that classifies patterns into three categories:

| Category | Question | Learning Type |
|----------|----------|---------------|
| **Policy Failure** | "Did the rules allow something they shouldn't?" | `constraint` |
| **Context Failure** | "Did the agent lack information it needed?" | `instruction` |
| **Behavioral Drift** | "Did the agent ignore a rule it already had?" | `constraint` |

Classification uses `generateObject` with structured Zod schema. The LLM outputs both the root cause category AND the `proposed_learning_type` (constraint | instruction) directly — no hardcoded category-to-type mapping. Dual gate: `should_propose_learning === false` OR `confidence < 0.70` → observation created instead of learning proposal.

## Alternatives Considered

### Frequency-only suggestion
Suggest a learning whenever 3+ observations cluster on the same topic. Text extracted from observation representative. No classification.
- **Rejected**: Produces generic learnings ("stop doing X") without diagnosing why. Doesn't distinguish between "the rules are wrong" and "the agent isn't following existing rules." The human reviewer gets a suggestion without the reasoning trace.

### Human-triggered only
Observer creates a special "pattern detected" observation. Human reads it and manually creates a learning.
- **Rejected**: Adds friction. Human must diagnose the root cause themselves. Doesn't leverage the graph traversal the Observer already does.

### Rule-based classification
Hardcoded heuristics (e.g., "if observation mentions policy → policy_failure").
- **Rejected**: Too brittle. Real patterns often span multiple categories. LLM classification with structured output gives reasoning traces.

## Consequences
- **Positive**: Learning proposals include diagnosis and evidence trail. Human reviewer sees *why* the Observer thinks this fix is needed, not just *what* to fix.
- **Positive**: LLM determines both root cause category AND learning type directly — no lossy hardcoded mapping.
- **Positive**: Reuses existing `suggestLearning()` gates — no new rate limiting or dismissed check infrastructure.
- **Negative**: Adds one LLM call per observation cluster during graph scan. Bounded by cluster count (typically 0-5 per scan). Cost: ~$0.01-0.05 per scan cycle.
- **Negative**: When observer model is unavailable, learning escalation is **entirely disabled** (graceful absence, not graceful degradation). Observations are still created, but never escalated to learning proposals. This is an intentional tradeoff: frequency-only escalation (Alternative 1) would provide availability but at the cost of generic, undiagnosed learnings that lack reasoning traces. We accept LLM-dependence for learning proposals because the diagnostic quality is the core value proposition — a learning without a root cause trace is just a noisy observation.

### Open Question
Should we implement frequency-only escalation as a future fallback for workspaces where observer model is unavailable? This would trade lower confidence for availability. Deferred to a future iteration — the current design can be extended to add a fallback path without architectural changes.
