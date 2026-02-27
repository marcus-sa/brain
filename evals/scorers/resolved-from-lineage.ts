import { createScorer } from "evalite";
import type { GoldenCase, ExtractionEvalOutput } from "../types";

export const resolvedFromLineageScorer = createScorer<GoldenCase, ExtractionEvalOutput, GoldenCase>({
  name: "resolved-from-lineage",
  description: "Score 1 when lineage cases persist resolved_from pointing to the expected context message id.",
  scorer: ({ output, expected }) => {
    if (expected.expectedResolvedFromContextIndex === undefined) {
      return { score: 1 };
    }

    const expectedMessageId = output.contextMessageIds[expected.expectedResolvedFromContextIndex];
    if (!expectedMessageId) {
      return {
        score: 0,
        metadata: {
          expectedResolvedFromContextIndex: expected.expectedResolvedFromContextIndex,
          contextMessageIds: output.contextMessageIds,
        },
      };
    }

    const matched = output.evidenceRows.some((row) => row.resolvedFromId === expectedMessageId);
    return {
      score: matched ? 1 : 0,
      metadata: matched
        ? undefined
        : {
            expectedResolvedFromId: expectedMessageId,
            actualResolvedFromIds: output.evidenceRows.map((row) => row.resolvedFromId),
          },
    };
  },
});
