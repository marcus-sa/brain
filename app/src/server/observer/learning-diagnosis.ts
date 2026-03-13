/**
 * Learning Diagnosis: Observation Clustering and Coverage Check
 *
 * Groups open observations by embedding similarity into clusters,
 * then checks if active learnings already cover each cluster pattern.
 *
 * Pure query functions + pipeline composition. IO at boundaries only.
 *
 * Step 01-01: Clustering + coverage check
 * Step 02: Root cause classification (future)
 * Step 03: Learning proposer + graph scan integration (future)
 */

import { RecordId, type Surreal } from "surrealdb";
import { logInfo } from "../http/observability";

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
  return { covered: false };
}

// ---------------------------------------------------------------------------
// Diagnostic pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs the observation clustering and coverage check pipeline.
 *
 * Pipeline:
 * 1. Query recent observations with embeddings
 * 2. Cluster by pairwise similarity
 * 3. For each cluster, check coverage against active learnings
 * 4. Return uncovered clusters for downstream processing (root cause classification)
 *
 * Step 01-01 scope: clustering + coverage check only.
 * Future steps add root cause classification and learning proposer.
 */
export async function runDiagnosticClustering(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
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

  return { clusters, uncoveredClusters, result: diagnosticResult };
}
