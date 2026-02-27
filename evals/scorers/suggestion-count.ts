import { createScorer } from "evalite";
import type { SuggestionGoldenCase, SuggestionsEvalOutput } from "../types";

export const suggestionCountScorer = createScorer<SuggestionGoldenCase, SuggestionsEvalOutput, SuggestionGoldenCase>({
  name: "suggestion-count",
  description: "Score 1 when suggestion count matches constraints (min expected, max 3).",
  scorer: ({ output, expected }) => {
    const expectedMinimum = expected.expectedMinSuggestions ?? 1;
    const count = output.suggestions.length;
    const valid = count >= expectedMinimum && count <= 3;

    return {
      score: valid ? 1 : 0,
      metadata: valid
        ? undefined
        : {
            expectedMinimum,
            actual: count,
          },
    };
  },
});
