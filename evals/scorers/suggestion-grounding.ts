import { createScorer } from "evalite";
import type { SuggestionGoldenCase, SuggestionsEvalOutput } from "../types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const suggestionGroundingScorer = createScorer<SuggestionGoldenCase, SuggestionsEvalOutput, SuggestionGoldenCase>({
  name: "suggestion-grounding",
  description: "Percent of suggestions that reference required latest-turn anchors.",
  scorer: ({ output, expected }) => {
    const expectedMinimum = expected.expectedMinSuggestions ?? 1;
    const normalizedAnchors = expected.requiredAnchors
      .map((anchor) => normalize(anchor))
      .filter((anchor) => anchor.length >= 3);
    if (output.suggestions.length === 0) {
      return {
        score: expectedMinimum === 0 ? 1 : 0,
      };
    }

    if (normalizedAnchors.length === 0) {
      return {
        score: 0,
        metadata: {
          reason: "no_required_anchors",
          suggestionCount: output.suggestions.length,
        },
      };
    }

    let groundedCount = 0;
    const unmatchedSuggestions: string[] = [];
    for (const suggestion of output.suggestions) {
      const normalizedSuggestion = normalize(suggestion);
      const grounded = normalizedAnchors.some((anchor) =>
        normalizedSuggestion.includes(anchor) || anchor.includes(normalizedSuggestion)
      );
      if (grounded) {
        groundedCount += 1;
      } else {
        unmatchedSuggestions.push(suggestion);
      }
    }

    return {
      score: groundedCount / output.suggestions.length,
      metadata: unmatchedSuggestions.length === 0 ? undefined : { unmatchedSuggestions },
    };
  },
});
