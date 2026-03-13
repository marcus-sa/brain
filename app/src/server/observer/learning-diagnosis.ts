/**
 * Learning Diagnosis: Observation Clustering, Root Cause Classification, and Learning Proposals
 *
 * Groups open observations by embedding similarity into clusters,
 * checks if active learnings already cover each cluster pattern,
 * classifies root causes via LLM structured output, and proposes learnings.
 *
 * Pure query functions + pipeline composition. IO at boundaries only.
 *
 * Step 01-01: Clustering + coverage check
 * Step 01-02: Root cause classification with LLM structured output
 * Step 03: Learning proposer + graph scan integration (future)
 */

import { RecordId, type Surreal } from "surrealdb";
import { generateObject, type LanguageModel } from "ai";
import { logError, logInfo } from "../http/observability";
import { rootCauseSchema, type RootCauseClassification } from "./schemas";
import { OBSERVER_IDENTITY } from "../agents/observer/prompt";
import { suggestLearning } from "../learning/detector";
import { createObservation } from "../observation/queries";
import type { CreateLearningInput } from "../learning/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ObservationWithEmbedding = {
  id: string;
  text: string;
  severity: string;
  embedding: number[];
  entityRefs: string[];
};

export type ObservationCluster = {
  observations: Array<{ id: string; text: string; severity: string; entityRefs: string[] }>;
  representativeText: string;
  clusterSize: number;
};

export type CoverageCheckResult =
  | { covered: false }
  | { covered: true; matchedLearningText: string; similarity: number };

export type DiagnosticResult = {
  learning_proposals_created: number;
  coverage_skips: number;
  clusters_found: number;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLUSTER_SIMILARITY_THRESHOLD = 0.75;
const MINIMUM_CLUSTER_SIZE = 3;
const TIME_WINDOW_DAYS = 14;
const COVERAGE_SIMILARITY_THRESHOLD = 0.80;

// ---------------------------------------------------------------------------
// Observation query (IO boundary)
// ---------------------------------------------------------------------------

/**
 * Queries open/acknowledged observations from the past 14 days with embeddings.
 * Uses two-step KNN pattern per SurrealDB HNSW+WHERE bug.
 */
export async function queryRecentObservationsWithEmbeddings(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
): Promise<ObservationWithEmbedding[]> {
  const cutoff = new Date(Date.now() - TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [rows] = await surreal.query<[Array<{
    id: RecordId<"observation">;
    text: string;
    severity: string;
    embedding: number[];
    entity_refs: string[];
    created_at: string;
  }>]>(
    `SELECT id, text, severity, embedding, created_at,
            ->observes->task.id AS entity_refs
     FROM observation
     WHERE workspace = $ws
       AND status IN ["open", "acknowledged"]
       AND created_at > $cutoff
       AND embedding IS NOT NONE
     ORDER BY created_at DESC
     LIMIT 200;`,
    { ws: workspaceRecord, cutoff },
  );

  return (rows ?? []).map((row) => ({
    id: row.id.id as string,
    text: row.text,
    severity: row.severity,
    embedding: row.embedding,
    entityRefs: (row.entity_refs ?? []).map((ref) =>
      typeof ref === "object" && ref !== null && "id" in ref
        ? `task:${(ref as RecordId).id as string}`
        : String(ref),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Pure clustering (no IO)
// ---------------------------------------------------------------------------

/**
 * Computes cosine similarity between two vectors.
 */
function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Clusters observations by pairwise embedding similarity using single-linkage.
 *
 * Algorithm:
 * 1. Build adjacency: observation A is neighbor of B if similarity > threshold
 * 2. Connected components via BFS form clusters
 * 3. Filter clusters by minimum size
 *
 * Pure function -- no IO.
 */
export function clusterObservationsBySimilarity(
  observations: ObservationWithEmbedding[],
  similarityThreshold: number = CLUSTER_SIMILARITY_THRESHOLD,
  minimumClusterSize: number = MINIMUM_CLUSTER_SIZE,
): ObservationCluster[] {
  if (observations.length < minimumClusterSize) return [];

  // Build adjacency list
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < observations.length; i++) {
    adjacency.set(i, new Set());
  }

  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const similarity = cosineSimilarity(
        observations[i].embedding,
        observations[j].embedding,
      );
      if (similarity > similarityThreshold) {
        adjacency.get(i)!.add(j);
        adjacency.get(j)!.add(i);
      }
    }
  }

  // BFS to find connected components
  const visited = new Set<number>();
  const clusters: ObservationCluster[] = [];

  for (let i = 0; i < observations.length; i++) {
    if (visited.has(i)) continue;

    const component: number[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of adjacency.get(current)!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= minimumClusterSize) {
      const clusterObservations = component.map((idx) => ({
        id: observations[idx].id,
        text: observations[idx].text,
        severity: observations[idx].severity,
        entityRefs: observations[idx].entityRefs,
      }));

      // Representative text: the observation with highest average similarity to others in cluster
      const representativeIndex = pickRepresentativeIndex(component, observations);

      clusters.push({
        observations: clusterObservations,
        representativeText: observations[representativeIndex].text,
        clusterSize: component.length,
      });
    }
  }

  return clusters;
}

/**
 * Picks the observation with highest average similarity to other cluster members.
 * Pure function.
 */
function pickRepresentativeIndex(
  componentIndices: number[],
  observations: ObservationWithEmbedding[],
): number {
  let bestIndex = componentIndices[0];
  let bestAvgSimilarity = -1;

  for (const i of componentIndices) {
    let totalSimilarity = 0;
    for (const j of componentIndices) {
      if (i !== j) {
        totalSimilarity += cosineSimilarity(
          observations[i].embedding,
          observations[j].embedding,
        );
      }
    }
    const avgSimilarity = totalSimilarity / (componentIndices.length - 1);
    if (avgSimilarity > bestAvgSimilarity) {
      bestAvgSimilarity = avgSimilarity;
      bestIndex = i;
    }
  }

  return bestIndex;
}

// ---------------------------------------------------------------------------
// Coverage check (IO boundary -- KNN query)
// ---------------------------------------------------------------------------

/**
 * Checks if an active learning already covers the cluster pattern.
 * Uses two-step KNN pattern per SurrealDB HNSW+WHERE bug.
 *
 * Returns covered=true if any active learning has similarity > 0.80
 * to the cluster's representative observation embedding.
 */
export async function checkCoverageAgainstActiveLearnings(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  clusterEmbedding: number[],
): Promise<CoverageCheckResult> {
  // Two-step KNN: LET returns null result, SELECT returns actual matches
  // query() returns array of statement results: [LET result, SELECT result]
  const results = await surreal
    .query<[undefined, Array<{ text: string; similarity: number }>]>(
      [
        "LET $candidates = SELECT id, text, workspace, status,",
        "vector::similarity::cosine(embedding, $embedding) AS similarity",
        "FROM learning WHERE embedding <|10, COSINE|> $embedding;",
        "SELECT text, similarity FROM $candidates",
        `WHERE workspace = $ws AND status = "active" AND similarity > ${COVERAGE_SIMILARITY_THRESHOLD}`,
        "ORDER BY similarity DESC LIMIT 1;",
      ].join("\n"),
      {
        embedding: clusterEmbedding,
        ws: workspaceRecord,
      },
    );

  // LET is index 0 (undefined), SELECT is index 1
  const matches = results[1] ?? [];
  const match = matches[0];
  if (match) {
    return { covered: true, matchedLearningText: match.text, similarity: match.similarity };
  }

  // Fallback: brute-force scan when HNSW index hasn't indexed recent inserts.
  // Queries all active learnings with embeddings and computes similarity in-app.
  const [activeLearnings] = await surreal.query<[Array<{ text: string; embedding: number[] }>]>(
    `SELECT text, embedding FROM learning
     WHERE workspace = $ws
       AND status = "active"
       AND embedding IS NOT NONE;`,
    { ws: workspaceRecord },
  );

  logInfo("observer.learning.coverage_fallback", "Fallback coverage check", {
    activeLearningsCount: (activeLearnings ?? []).length,
    workspaceId: workspaceRecord.id,
  });

  for (const learning of activeLearnings ?? []) {
    const similarity = cosineSimilarity(clusterEmbedding, learning.embedding);
    if (similarity > COVERAGE_SIMILARITY_THRESHOLD) {
      return { covered: true, matchedLearningText: learning.text, similarity };
    }
  }

  return { covered: false };
}

// ---------------------------------------------------------------------------
// Root cause classification (LLM structured output)
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 0.70;
const CLASSIFICATION_TIMEOUT_MS = 30_000;

/**
 * Builds the LLM prompt for root cause classification.
 * Pure function -- formats cluster and context into prompt text.
 */
function buildClassificationPrompt(
  cluster: ObservationCluster,
  existingLearnings: string[],
): string {
  const observationQuotes = cluster.observations
    .map((obs, i) => `  ${i + 1}. [${obs.severity}] "${obs.text}"`)
    .join("\n");

  const entityRefsList = [
    ...new Set(cluster.observations.flatMap((obs) => obs.entityRefs)),
  ];
  const entityRefsText = entityRefsList.length > 0
    ? entityRefsList.map((ref) => `  - ${ref}`).join("\n")
    : "  No linked entities.";

  const learningsText = existingLearnings.length > 0
    ? existingLearnings.map((l, i) => `  ${i + 1}. ${l}`).join("\n")
    : "  No active learnings.";

  return `You are performing root cause analysis on a recurring pattern detected in the workspace.

## Pattern Detected
Representative text: "${cluster.representativeText}"

Observation quotes (${cluster.clusterSize} occurrences):
${observationQuotes}

## Related Entities
${entityRefsText}

## Existing Active Learnings
${learningsText}

## Classification Instructions
Determine WHY this pattern keeps recurring:

1. Policy Failure: The governance rules allowed something they shouldn't.
   -> Propose a constraint that tightens the boundary.

2. Context Failure: The agent lacked information it needed to act correctly.
   -> Propose an instruction that injects the missing context.

3. Behavioral Drift: The agent had the information but didn't apply it.
   -> Propose a constraint that reinforces the expected behavior.

Set should_propose_learning to true ONLY if:
- confidence >= 0.70
- You have high conviction in both the category AND the proposed text
- The proposed learning is specific enough to be actionable

Set should_propose_learning to false if:
- The root cause is ambiguous or could fit multiple categories
- The proposed learning text is too generic ("be more careful")
- The evidence is insufficient to justify a permanent behavioral rule

For proposed_learning_type, choose based on the fix needed:
- "constraint" for must-follow rules (policy fixes, behavioral reinforcement)
- "instruction" for conditional guidance (context injection, situational awareness)

In evidence_refs, list the observation IDs in table:id format (e.g. observation:uuid).
In target_agents, list the agent types that should receive this learning.`;
}

/**
 * Classifies the root cause of an observation cluster using LLM structured output.
 * Returns undefined on any failure (timeout, rate limit, invalid output).
 */
export async function classifyRootCause(
  model: LanguageModel,
  cluster: ObservationCluster,
  existingLearnings: string[],
): Promise<RootCauseClassification | undefined> {
  const start = Date.now();

  try {
    const prompt = buildClassificationPrompt(cluster, existingLearnings);

    const result = await generateObject({
      model,
      system: OBSERVER_IDENTITY,
      schema: rootCauseSchema,
      prompt,
      abortSignal: AbortSignal.timeout(CLASSIFICATION_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;
    logInfo("observer.llm.root_cause", "Root cause classification completed", {
      latencyMs,
      category: result.object.category,
      confidence: result.object.confidence,
      shouldPropose: result.object.should_propose_learning,
    });

    return result.object;
  } catch (error) {
    const latencyMs = Date.now() - start;
    logError("observer.llm.root_cause_error", "Root cause classification failed", {
      error,
      latencyMs,
    });
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Dual gate: decide whether to propose learning or create observation
// ---------------------------------------------------------------------------

/**
 * Applies the dual gate: should_propose_learning AND confidence >= threshold.
 * Pure function -- no IO.
 */
function shouldProposeLearning(classification: RootCauseClassification): boolean {
  return classification.should_propose_learning && classification.confidence >= CONFIDENCE_THRESHOLD;
}

/**
 * Maps a root cause classification to a CreateLearningInput.
 * Pure function -- no IO.
 */
function rootCauseToLearningInput(
  classification: RootCauseClassification,
  cluster: ObservationCluster,
): CreateLearningInput {
  return {
    text: classification.proposed_learning_text,
    learningType: classification.proposed_learning_type,
    source: "agent",
    suggestedBy: "observer",
    patternConfidence: classification.confidence,
    targetAgents: classification.target_agents,
    evidenceIds: cluster.observations.map((obs) => ({
      table: "observation" as const,
      id: obs.id,
    })),
  };
}

// ---------------------------------------------------------------------------
// Query existing active learnings for classification context
// ---------------------------------------------------------------------------

async function queryActiveLearningTexts(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
): Promise<string[]> {
  const [rows] = await surreal.query<[Array<{ text: string; created_at: string }>]>(
    `SELECT text, created_at FROM learning
     WHERE workspace = $ws AND status = "active"
     ORDER BY created_at DESC
     LIMIT 20;`,
    { ws: workspaceRecord },
  );
  return (rows ?? []).map((r) => r.text);
}

// ---------------------------------------------------------------------------
// Process a single uncovered cluster: classify and propose or observe
// ---------------------------------------------------------------------------

async function processUncoveredCluster(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  model: LanguageModel,
  cluster: ObservationCluster,
  existingLearnings: string[],
): Promise<{ proposed: boolean }> {
  const classification = await classifyRootCause(model, cluster, existingLearnings);

  if (!classification) {
    // LLM call failed -- skip this cluster silently
    return { proposed: false };
  }

  if (shouldProposeLearning(classification)) {
    const learningInput = rootCauseToLearningInput(classification, cluster);

    const result = await suggestLearning({
      surreal,
      workspaceRecord,
      learning: learningInput,
      now: new Date(),
    });

    if (result.created) {
      logInfo("observer.learning.proposed", "Learning proposed from root cause analysis", {
        category: classification.category,
        confidence: classification.confidence,
        learningType: classification.proposed_learning_type,
        learningId: result.learningRecord.id,
      });
      return { proposed: true };
    }

    logInfo("observer.learning.gate_blocked", "Learning proposal blocked by safety gate", {
      reason: result.reason,
    });
    return { proposed: false };
  }

  // Dual gate failed: create an observation instead
  await createObservation({
    surreal,
    workspaceRecord,
    text: `Emerging pattern detected but root cause unclear (${classification.category}, confidence: ${classification.confidence.toFixed(2)}): ${classification.reasoning}`,
    severity: "info",
    sourceAgent: "observer_agent",
    observationType: "pattern",
    now: new Date(),
  });

  logInfo("observer.learning.low_confidence", "Pattern observed but confidence too low for learning proposal", {
    category: classification.category,
    confidence: classification.confidence,
    shouldPropose: classification.should_propose_learning,
  });

  return { proposed: false };
}

// ---------------------------------------------------------------------------
// Diagnostic pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs the observation clustering, coverage check, and root cause classification pipeline.
 *
 * Pipeline:
 * 1. Query recent observations with embeddings
 * 2. Cluster by pairwise similarity
 * 3. For each cluster, check coverage against active learnings
 * 4. For uncovered clusters, classify root cause via LLM
 * 5. Propose learning or create observation based on dual gate
 */
export async function runDiagnosticClustering(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  observerModel?: LanguageModel,
): Promise<{
  clusters: ObservationCluster[];
  uncoveredClusters: ObservationCluster[];
  result: DiagnosticResult;
}> {
  const diagnosticResult: DiagnosticResult = {
    learning_proposals_created: 0,
    coverage_skips: 0,
    clusters_found: 0,
  };

  // Step 1: Query recent observations
  const observations = await queryRecentObservationsWithEmbeddings(
    surreal,
    workspaceRecord,
  );

  if (observations.length < MINIMUM_CLUSTER_SIZE) {
    return { clusters: [], uncoveredClusters: [], result: diagnosticResult };
  }

  // Step 2: Cluster by similarity (pure)
  const clusters = clusterObservationsBySimilarity(observations);
  diagnosticResult.clusters_found = clusters.length;

  if (clusters.length === 0) {
    return { clusters: [], uncoveredClusters: [], result: diagnosticResult };
  }

  // Step 3: Coverage check for each cluster
  const uncoveredClusters: ObservationCluster[] = [];

  for (const cluster of clusters) {
    // Find the representative observation's embedding for coverage check
    const representativeObs = observations.find(
      (obs) => obs.text === cluster.representativeText,
    );

    if (!representativeObs) {
      // Should not happen, but handle gracefully
      uncoveredClusters.push(cluster);
      continue;
    }

    const coverage = await checkCoverageAgainstActiveLearnings(
      surreal,
      workspaceRecord,
      representativeObs.embedding,
    );

    if (coverage.covered) {
      logInfo("observer.learning.coverage_skip", "Cluster pattern already covered by active learning", {
        clusterSize: cluster.clusterSize,
        matchedLearningText: coverage.matchedLearningText,
        similarity: coverage.similarity,
      });
      diagnosticResult.coverage_skips += 1;
    } else {
      uncoveredClusters.push(cluster);
    }
  }

  // Step 4: Root cause classification for uncovered clusters (requires observer model)
  if (observerModel && uncoveredClusters.length > 0) {
    const existingLearnings = await queryActiveLearningTexts(surreal, workspaceRecord);

    for (const cluster of uncoveredClusters) {
      const { proposed } = await processUncoveredCluster(
        surreal,
        workspaceRecord,
        observerModel,
        cluster,
        existingLearnings,
      );

      if (proposed) {
        diagnosticResult.learning_proposals_created += 1;
      }
    }
  }

  return { clusters, uncoveredClusters, result: diagnosticResult };
}
