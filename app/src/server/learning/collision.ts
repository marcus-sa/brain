/**
 * Three-layer collision detection for agent learnings.
 *
 * Checks new learning text against:
 *   1. Existing active learnings (duplicate > 0.90, LLM classify 0.75-0.90)
 *   2. Active policies (LLM classify > 0.80, contradiction = hard block)
 *   3. Confirmed decisions (LLM classify > 0.80, contradiction = informational)
 *
 * Uses two-step KNN pattern to avoid SurrealDB HNSW + WHERE index conflict.
 * LLM classification defaults to "contradicts" on failure (fail-safe).
 */
import { generateObject } from "ai";
import { RecordId, type Surreal } from "surrealdb";
import { z } from "zod";
import { logInfo, logWarn } from "../http/observability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollisionClassification =
  | "contradicts"
  | "duplicates"
  | "reinforces"
  | "unrelated";

export type CollisionTargetKind = "learning" | "policy" | "decision";

export type CollisionResult = {
  collisionType: CollisionClassification;
  targetKind: CollisionTargetKind;
  targetId: string;
  targetText: string;
  similarity: number;
  blocking: boolean;
  reasoning?: string;
};

export type CollisionCheckResult = {
  collisions: CollisionResult[];
  hasBlockingCollision: boolean;
  deferred?: boolean;
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const LEARNING_THRESHOLD = 0.75;
const LEARNING_DUPLICATE_THRESHOLD = 0.90;
// Cross-entity thresholds are lower because embeddings of different entity types
// (learning text vs policy description vs decision summary) have lower cosine
// similarity even when topically related. The LLM classifier handles accuracy.
const POLICY_THRESHOLD = 0.40;
const DECISION_THRESHOLD = 0.55;

// ---------------------------------------------------------------------------
// LLM classification schema
// ---------------------------------------------------------------------------

const classificationSchema = z.object({
  classification: z.enum(["contradicts", "reinforces", "unrelated"]).describe(
    "How learning A relates to target B: contradicts (opposite/incompatible), reinforces (compatible/complementary), unrelated (different domains)",
  ),
  reasoning: z.string().describe("Brief explanation of the classification"),
});

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function checkCollisions(input: {
  surreal: Surreal;
  model: unknown;
  workspaceRecord: RecordId<"workspace", string>;
  learningText: string;
  learningEmbedding?: number[];
  source: "human" | "agent";
}): Promise<CollisionCheckResult> {
  const { surreal, model, workspaceRecord, learningText, learningEmbedding, source } = input;

  // Fail-open/closed when embedding unavailable
  if (!learningEmbedding) {
    if (source === "human") {
      return { collisions: [], hasBlockingCollision: false };
    }
    // Agent-suggested: defer collision check
    return { collisions: [], hasBlockingCollision: false, deferred: true };
  }

  const collisions: CollisionResult[] = [];

  // Layer 1: Learning-vs-learning
  const learningCandidates = await findSimilarLearnings(surreal, workspaceRecord, learningEmbedding);
  for (const candidate of learningCandidates) {
    if (candidate.similarity > LEARNING_DUPLICATE_THRESHOLD) {
      collisions.push({
        collisionType: "duplicates",
        targetKind: "learning",
        targetId: candidate.id,
        targetText: candidate.text,
        similarity: candidate.similarity,
        blocking: false,
      });
    } else if (candidate.similarity > LEARNING_THRESHOLD) {
      const classification = await classifyWithLlm(model, learningText, candidate.text);
      if (classification.classification !== "unrelated") {
        collisions.push({
          collisionType: classification.classification,
          targetKind: "learning",
          targetId: candidate.id,
          targetText: candidate.text,
          similarity: candidate.similarity,
          blocking: false,
          reasoning: classification.reasoning,
        });
      }
    }
  }

  // Layer 2: Learning-vs-policy (contradiction = hard block)
  const policyCandidates = await findSimilarPolicies(surreal, workspaceRecord, learningEmbedding);
  for (const candidate of policyCandidates) {
    const classification = await classifyWithLlm(model, learningText, candidate.text);
    const isContradiction = classification.classification === "contradicts";
    if (classification.classification !== "unrelated") {
      collisions.push({
        collisionType: classification.classification,
        targetKind: "policy",
        targetId: candidate.id,
        targetText: candidate.text,
        similarity: candidate.similarity,
        blocking: isContradiction,
        reasoning: classification.reasoning,
      });
    }
  }

  // Layer 3: Learning-vs-decision (always informational)
  const decisionCandidates = await findSimilarDecisions(surreal, workspaceRecord, learningEmbedding);
  for (const candidate of decisionCandidates) {
    const classification = await classifyWithLlm(model, learningText, candidate.text);
    if (classification.classification !== "unrelated") {
      collisions.push({
        collisionType: classification.classification,
        targetKind: "decision",
        targetId: candidate.id,
        targetText: candidate.text,
        similarity: candidate.similarity,
        blocking: false,
        reasoning: classification.reasoning,
      });
    }
  }

  const hasBlockingCollision = collisions.some((c) => c.blocking);

  logInfo("learning.collision.checked", "Collision check completed", {
    totalCollisions: collisions.length,
    hasBlockingCollision,
    learningCollisions: collisions.filter((c) => c.targetKind === "learning").length,
    policyCollisions: collisions.filter((c) => c.targetKind === "policy").length,
    decisionCollisions: collisions.filter((c) => c.targetKind === "decision").length,
  });

  return { collisions, hasBlockingCollision };
}

// ---------------------------------------------------------------------------
// LLM intent classification
// ---------------------------------------------------------------------------

async function classifyWithLlm(
  model: unknown,
  learningText: string,
  targetText: string,
): Promise<{ classification: "contradicts" | "reinforces" | "unrelated"; reasoning: string }> {
  try {
    const result = await generateObject({
      model: model as any,
      schema: classificationSchema,
      temperature: 0.1,
      prompt: [
        `Given learning A: "${learningText}"`,
        `And target B: "${targetText}"`,
        "",
        "Classify the relationship between A and B:",
        "- contradicts: A and B give opposite or incompatible instructions/constraints",
        "- reinforces: A and B are compatible, complementary, or point in the same direction",
        "- unrelated: A and B are about different topics or domains with no meaningful overlap",
      ].join("\n"),
    });
    return result.object;
  } catch (error) {
    // Fail-safe: default to "contradicts" when LLM unavailable
    logWarn("learning.collision.llm_failed", "LLM classification failed, defaulting to contradicts", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      classification: "contradicts",
      reasoning: "LLM classification unavailable; defaulting to contradicts for safety",
    };
  }
}

// ---------------------------------------------------------------------------
// KNN queries (two-step pattern for SurrealDB HNSW + WHERE bug)
// ---------------------------------------------------------------------------

type SimilarityCandidate = {
  id: string;
  text: string;
  similarity: number;
};

async function findSimilarLearnings(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  embedding: number[],
): Promise<SimilarityCandidate[]> {
  const sql = `
    LET $candidates = SELECT id, text, workspace, status, vector::similarity::cosine(embedding, $embedding) AS similarity
      FROM learning WHERE embedding <|20, COSINE|> $embedding;
    SELECT id, text, similarity FROM $candidates
      WHERE workspace = $ws AND status = "active" AND similarity > ${LEARNING_THRESHOLD}
      ORDER BY similarity DESC LIMIT 10;
  `;
  const results = await surreal.query<[null, Array<{ id: RecordId; text: string; similarity: number }>]>(sql, {
    embedding,
    ws: workspaceRecord,
  });
  const rows = results[1] ?? [];
  return rows.map((row) => ({
    id: row.id.id as string,
    text: row.text,
    similarity: row.similarity,
  }));
}

async function findSimilarPolicies(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  embedding: number[],
): Promise<SimilarityCandidate[]> {
  const sql = `
    LET $candidates = SELECT id, title, description, workspace, status, vector::similarity::cosine(embedding, $embedding) AS similarity
      FROM policy WHERE embedding <|20, COSINE|> $embedding;
    SELECT id, title, description, similarity FROM $candidates
      WHERE workspace = $ws AND status = "active" AND similarity > ${POLICY_THRESHOLD}
      ORDER BY similarity DESC LIMIT 10;
  `;
  const results = await surreal.query<[null, Array<{ id: RecordId; title: string; description?: string; similarity: number }>]>(sql, {
    embedding,
    ws: workspaceRecord,
  });
  const rows = results[1] ?? [];
  return rows.map((row) => ({
    id: row.id.id as string,
    text: row.description ?? row.title,
    similarity: row.similarity,
  }));
}

async function findSimilarDecisions(
  surreal: Surreal,
  workspaceRecord: RecordId<"workspace", string>,
  embedding: number[],
): Promise<SimilarityCandidate[]> {
  const sql = `
    LET $candidates = SELECT id, summary, workspace, vector::similarity::cosine(embedding, $embedding) AS similarity
      FROM decision WHERE embedding <|20, COSINE|> $embedding;
    SELECT id, summary, similarity FROM $candidates
      WHERE workspace = $ws AND similarity > ${DECISION_THRESHOLD}
      ORDER BY similarity DESC LIMIT 10;
  `;
  const results = await surreal.query<[null, Array<{ id: RecordId; summary: string; similarity: number }>]>(sql, {
    embedding,
    ws: workspaceRecord,
  });
  const rows = results[1] ?? [];
  return rows.map((row) => ({
    id: row.id.id as string,
    text: row.summary,
    similarity: row.similarity,
  }));
}
