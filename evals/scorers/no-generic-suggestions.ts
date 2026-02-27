import { createScorer } from "evalite";
import type { SuggestionGoldenCase, SuggestionsEvalOutput } from "../types";

const blockedTemplates = [
  "list key team members",
  "describe current project",
  "describe current projects",
  "identify biggest bottleneck",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const noGenericSuggestionsScorer = createScorer<SuggestionGoldenCase, SuggestionsEvalOutput, SuggestionGoldenCase>({
  name: "no-generic-suggestions",
  description: "Score 1 when suggestions avoid known generic templates.",
  scorer: ({ output, expected }) => {
    const additionalBlocked = (expected.forbiddenSuggestions ?? []).map((value) => normalize(value));
    const activeBlocked = [...blockedTemplates, ...additionalBlocked];
    const matchedBlocked = output.suggestions.filter((suggestion) => {
      const normalizedSuggestion = normalize(suggestion);
      return activeBlocked.some((template) =>
        normalizedSuggestion === template || normalizedSuggestion.startsWith(`${template} `)
      );
    });

    return {
      score: matchedBlocked.length === 0 ? 1 : 0,
      metadata: matchedBlocked.length === 0 ? undefined : { matchedBlocked },
    };
  },
});
