# Observer Learning Proposals — Component Boundaries

## Component Inventory

| Component | File | Responsibility | IO | Paradigm |
|-----------|------|----------------|-----|----------|
| Observation Clusterer | `observer/learning-diagnosis.ts` | Group observations by embedding similarity, filter by threshold | SurrealDB (KNN queries) | Effect boundary |
| Root Cause Classifier | `observer/learning-diagnosis.ts` | LLM-based diagnosis: policy failure / context failure / behavioral drift | LLM (generateObject) | Effect boundary |
| Learning Proposer | `observer/learning-diagnosis.ts` | Compose CreateLearningInput, delegate to suggestLearning() | SurrealDB (via detector.ts) | Pure mapping + delegation |
| Coverage Checker | `observer/learning-diagnosis.ts` | KNN against active learnings to skip already-covered patterns | SurrealDB (KNN queries) | Effect boundary |
| Root Cause Schema | `observer/schemas.ts` | Zod schema for LLM structured output | None | Pure |
| Graph Scan Step 6 | `observer/graph-scan.ts` | Orchestrates diagnostic pipeline after pattern synthesis | Composition | Orchestrator |
| Event Escalation | `agents/observer/agent.ts` | Triggers diagnosis when entity hits 3+ observations | SurrealDB + LLM | Effect boundary |

## Dependency Graph

```
graph-scan.ts (step 6)
  └── learning-diagnosis.ts
        ├── observationClusterer  → SurrealDB (KNN)
        ├── coverageChecker       → SurrealDB (KNN)
        ├── rootCauseClassifier   → LLM (generateObject)
        └── learningProposer      → learning/detector.ts (suggestLearning)
                                      ├── learning/queries.ts (createLearning)
                                      └── SurrealDB
```

```
agents/observer/agent.ts (event path)
  └── persistObservation (existing)
  └── checkEscalationThreshold → SurrealDB (count query)
        └── learning-diagnosis.ts (same pipeline)
```

## Interface Contracts

### `diagnoseLearningFromCluster`

Main entry point called by both graph scan and event-driven escalation.

```typescript
type DiagnoseLearningInput = {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  observerModel: LanguageModel;
  cluster: ObservationCluster;
  embeddingModel?: EmbeddingModel;
};

type DiagnoseLearningResult =
  | { action: "learning_proposed"; learningId: string }
  | { action: "skipped_existing_coverage"; activeLearningText: string }
  | { action: "skipped_not_proposed"; confidence: number; reasoning: string }
  | { action: "skipped_recent_duplicate"; existingLearningText: string }
  | { action: "skipped_rate_limited"; count: number }
  | { action: "skipped_dismissed_similarity"; matchedText: string }
  | { action: "failed"; reason: string };
```

### `clusterObservations`

```typescript
type ClusterObservationsInput = {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  minClusterSize?: number;    // default: 3
  timeWindowDays?: number;    // default: 14
  similarityThreshold?: number; // default: 0.75
};

type ObservationCluster = {
  observations: Array<{
    id: string;
    text: string;
    severity: string;
    entityRefs: string[];
  }>;
  representativeText: string;
  clusterSize: number;
};
```

### `classifyRootCause`

```typescript
type RootCauseResult = {
  category: "policy_failure" | "context_failure" | "behavioral_drift";
  should_propose_learning: boolean;
  proposed_learning_type: "constraint" | "instruction";
  reasoning: string;
  proposed_learning_text: string;
  target_agents: string[];
  evidence_refs: string[];
  confidence: number;
};
```

## Testing Strategy

| Component | Test Type | What to Assert |
|-----------|-----------|----------------|
| `clusterObservations` | Acceptance | 3 similar observations → 1 cluster; 2 observations → no cluster; different topics → separate clusters |
| `classifyRootCause` | Unit (mocked model) | LLM determines proposed_learning_type directly; should_propose_learning=false → skipped; confidence < 0.70 → skipped |
| `rootCauseToLearningInput` | Unit (pure) | Correct field mapping; evidence IDs from cluster observations; learning_type from LLM proposed_learning_type |
| `checkExistingCoverage` | Acceptance | Active learning with similarity > 0.80 → skip; no match → proceed |
| `diagnoseLearningFromCluster` | Acceptance | Full pipeline: cluster → classify → propose → learning record exists |
| Graph scan step 6 | Acceptance | 3 observations in workspace → scan produces learning_proposals_created: 1 |
| Event escalation | Acceptance | 3rd observation on entity triggers diagnosis; 2nd does not |
| Event/scan dedup | Acceptance | Graph scan proposes learning; subsequent event-driven escalation for same pattern is skipped |
| Rate limit integration | Acceptance | 6th suggestion in 7 days → skipped_rate_limited |
| Dismissed re-suggestion | Acceptance | Dismissed learning with similar text → skipped_dismissed_similarity |

## Reuse Analysis

| Existing Component | Reused As-Is | Notes |
|-------------------|--------------|-------|
| `learning/detector.ts:suggestLearning()` | Yes | Rate limit + dismissed similarity gates |
| `learning/detector.ts:checkRateLimit()` | Yes | Called by suggestLearning |
| `learning/detector.ts:checkDismissedSimilarity()` | Yes | Called by suggestLearning |
| `learning/queries.ts:createLearning()` | Yes | Called by suggestLearning |
| `observer/schemas.ts` | Extended | Add rootCauseSchema |
| `observer/graph-scan.ts:runGraphScan()` | Extended | Add step 6 |
| `agents/observer/agent.ts:persistObservation()` | Extended | Add escalation check after |
| `observer/llm-reasoning.ts` pattern | Pattern reused | generateObject + timeout + error handling |
