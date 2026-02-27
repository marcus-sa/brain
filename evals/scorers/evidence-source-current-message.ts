import { createScorer } from "evalite";
import type { GoldenCase, ExtractionEvalOutput } from "../types";

export const evidenceSourceCurrentMessageScorer = createScorer<GoldenCase, ExtractionEvalOutput, GoldenCase>({
  name: "evidence-source-current-message",
  description: "Score 1 when every provenance edge stores evidence_source as the current extracted user message id.",
  scorer: ({ output }) => {
    if (output.evidenceRows.length === 0) {
      return { score: output.extractedEntities.length === 0 ? 1 : 0 };
    }

    const mismatched = output.evidenceRows.filter((row) => row.evidenceSourceId !== output.userMessageId);
    return {
      score: mismatched.length === 0 ? 1 : 0,
      metadata: mismatched.length === 0
        ? undefined
        : { userMessageId: output.userMessageId, mismatchedEvidenceSourceIds: mismatched.map((row) => row.evidenceSourceId) },
    };
  },
});
