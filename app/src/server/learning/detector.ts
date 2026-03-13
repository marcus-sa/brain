/**
 * Pattern Detection Module
 *
 * Rate limiting gate and dismissed re-suggestion prevention for agent-suggested learnings.
 * Pure functions that compose query results into blocking/allow decisions.
 */
import { RecordId, type Surreal } from "surrealdb";
import { countRecentSuggestionsByAgent, createLearning } from "./queries";
import type { CreateLearningInput, LearningRecord } from "./types";

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type RateLimitResult =
  | { blocked: false; count: number }
  | { blocked: true; count: number };

export type DismissedSimilarityResult =
  | { blocked: false }
  | { blocked: true; matchedText: string };

export type SuggestLearningResult =
  | { created: true; learningRecord: LearningRecord }
  | { created: false; reason: "rate_limited"; count: number }
  | { created: false; reason: "dismissed_similarity"; matchedText: string };

// ---------------------------------------------------------------------------
// Rate limit check
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 5;

export async function checkRateLimit(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  agentType: string;
}): Promise<RateLimitResult> {
  const count = await countRecentSuggestionsByAgent({
    surreal: input.surreal,
    workspaceRecord: input.workspaceRecord,
    agentType: input.agentType,
  });

  return count >= RATE_LIMIT_MAX
    ? { blocked: true, count }
    : { blocked: false, count };
}

// ---------------------------------------------------------------------------
// Dismissed similarity check (KNN two-step pattern)
// ---------------------------------------------------------------------------

export async function checkDismissedSimilarity(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  proposedEmbedding: number[];
}): Promise<DismissedSimilarityResult> {
  // Step 1: KNN candidates (HNSW index only)
  // Step 2: Filter by workspace + dismissed status + similarity threshold
  const [matches] = await input.surreal
    .query<[Array<{ text: string; similarity: number }>]>(
      [
        "LET $candidates = SELECT id, text, workspace, status,",
        "vector::similarity::cosine(embedding, $embedding) AS similarity",
        "FROM learning WHERE embedding <|10, COSINE|> $embedding;",
        "SELECT text, similarity FROM $candidates",
        'WHERE workspace = $ws AND status = "dismissed" AND similarity > 0.85',
        "ORDER BY similarity DESC LIMIT 1;",
      ].join("\n"),
      {
        embedding: input.proposedEmbedding,
        ws: input.workspaceRecord,
      },
    )
    .collect<[Array<{ text: string; similarity: number }>]>();

  const match = matches[0];
  if (match) {
    return { blocked: true, matchedText: match.text };
  }
  return { blocked: false };
}

// ---------------------------------------------------------------------------
// Suggest learning (orchestrates gates then creates)
// ---------------------------------------------------------------------------

export async function suggestLearning(input: {
  surreal: Surreal;
  workspaceRecord: RecordId<"workspace", string>;
  learning: CreateLearningInput;
  embedding?: number[];
  now: Date;
}): Promise<SuggestLearningResult> {
  const agentType = input.learning.suggestedBy ?? "unknown_agent";

  // Gate 1: Rate limit
  const rateLimit = await checkRateLimit({
    surreal: input.surreal,
    workspaceRecord: input.workspaceRecord,
    agentType,
  });

  if (rateLimit.blocked) {
    return { created: false, reason: "rate_limited", count: rateLimit.count };
  }

  // Gate 2: Dismissed similarity (only when embedding available)
  if (input.embedding) {
    const dismissed = await checkDismissedSimilarity({
      surreal: input.surreal,
      workspaceRecord: input.workspaceRecord,
      proposedEmbedding: input.embedding,
    });

    if (dismissed.blocked) {
      return {
        created: false,
        reason: "dismissed_similarity",
        matchedText: dismissed.matchedText,
      };
    }
  }

  // Both gates passed -- create learning as pending_approval
  const learningRecord = await createLearning({
    surreal: input.surreal,
    workspaceRecord: input.workspaceRecord,
    learning: {
      ...input.learning,
      source: "agent",
    },
    now: input.now,
    embedding: input.embedding,
  });

  return { created: true, learningRecord };
}
