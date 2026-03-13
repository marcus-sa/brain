/**
 * Pure formatter for agent learnings.
 *
 * No IO imports -- this module is entirely pure.
 * Groups learnings by type and renders as markdown for prompt injection.
 */
import type { LoadedLearning } from "./loader";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Estimates token count from text using word-count heuristic.
 * Approximation: ~0.75 words per token (English text average).
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  const wordCount = trimmed.split(/\s+/).length;
  return Math.ceil(wordCount / 0.75);
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

const SECTION_ORDER: ReadonlyArray<{ type: LoadedLearning["learningType"]; heading: string }> = [
  { type: "constraint", heading: "Constraints" },
  { type: "instruction", heading: "Instructions" },
  { type: "precedent", heading: "Precedents" },
];

function formatLearningLine(learning: LoadedLearning): string {
  if (learning.learningType === "precedent" && learning.similarity !== undefined) {
    return `- ${learning.text} (similarity: ${learning.similarity.toFixed(2)})`;
  }
  return `- ${learning.text}`;
}

/**
 * Renders learnings as a grouped markdown section.
 * Only includes sections that have at least one learning.
 * Returns empty string when no learnings provided.
 */
export function formatLearningsSection(learnings: ReadonlyArray<LoadedLearning>): string {
  if (learnings.length === 0) return "";

  const sections = SECTION_ORDER
    .map(({ type, heading }) => {
      const items = learnings.filter((l) => l.learningType === type);
      if (items.length === 0) return undefined;
      const lines = items.map(formatLearningLine).join("\n");
      return `### ${heading}\n${lines}`;
    })
    .filter((section): section is string => section !== undefined);

  if (sections.length === 0) return "";

  return `## Workspace Learnings\n\n${sections.join("\n\n")}`;
}
