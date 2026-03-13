/**
 * Unit tests for learning formatter and token estimation.
 *
 * Pure function tests -- no IO, no SurrealDB.
 */
import { describe, expect, it } from "bun:test";
import { estimateTokens, formatLearningsSection } from "../../app/src/server/learning/formatter";
import { applyTokenBudget } from "../../app/src/server/learning/loader";
import type { LoadedLearning } from "../../app/src/server/learning/loader";

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe("estimateTokens", () => {
  it("estimates tokens from word count divided by 0.75", () => {
    // 4 words -> ceil(4 / 0.75) = ceil(5.33) = 6
    expect(estimateTokens("hello world foo bar")).toBe(6);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("handles whitespace-only string", () => {
    expect(estimateTokens("   ")).toBe(0);
  });

  it("handles single word", () => {
    // 1 word -> ceil(1 / 0.75) = ceil(1.33) = 2
    expect(estimateTokens("hello")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// formatLearningsSection
// ---------------------------------------------------------------------------

describe("formatLearningsSection", () => {
  it("renders grouped sections under Workspace Learnings heading", () => {
    const learnings: LoadedLearning[] = [
      {
        id: "1",
        text: "Never use null",
        learningType: "constraint",
        source: "human",
        priority: "high",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        text: "Use RecordId objects",
        learningType: "instruction",
        source: "human",
        priority: "medium",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "3",
        text: "PostgreSQL chosen over MySQL",
        learningType: "precedent",
        source: "agent",
        priority: "medium",
        createdAt: "2026-01-01T00:00:00Z",
        similarity: 0.85,
      },
    ];

    const output = formatLearningsSection(learnings);

    expect(output).toContain("## Workspace Learnings");
    expect(output).toContain("### Constraints");
    expect(output).toContain("- Never use null");
    expect(output).toContain("### Instructions");
    expect(output).toContain("- Use RecordId objects");
    expect(output).toContain("### Precedents");
    expect(output).toContain("- PostgreSQL chosen over MySQL (similarity: 0.85)");
  });

  it("omits sections with no learnings", () => {
    const learnings: LoadedLearning[] = [
      {
        id: "1",
        text: "Never use null",
        learningType: "constraint",
        source: "human",
        priority: "high",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];

    const output = formatLearningsSection(learnings);

    expect(output).toContain("### Constraints");
    expect(output).not.toContain("### Instructions");
    expect(output).not.toContain("### Precedents");
  });

  it("returns empty string for empty learnings array", () => {
    expect(formatLearningsSection([])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// applyTokenBudget
// ---------------------------------------------------------------------------

describe("applyTokenBudget", () => {
  const makeConstraint = (text: string): LoadedLearning => ({
    id: crypto.randomUUID(),
    text,
    learningType: "constraint",
    source: "human",
    priority: "high",
    createdAt: "2026-01-01T00:00:00Z",
  });

  const makeInstruction = (text: string, priority: "high" | "medium" | "low" = "medium"): LoadedLearning => ({
    id: crypto.randomUUID(),
    text,
    learningType: "instruction",
    source: "human",
    priority,
    createdAt: "2026-01-01T00:00:00Z",
  });

  const makePrecedent = (text: string, similarity: number): LoadedLearning => ({
    id: crypto.randomUUID(),
    text,
    learningType: "precedent",
    source: "agent",
    priority: "medium",
    createdAt: "2026-01-01T00:00:00Z",
    similarity,
  });

  it("always includes all constraints even when they exceed budget", () => {
    // Create constraints that together exceed a small budget (~31 tokens each, 310 total > 200)
    const constraints = Array.from({ length: 10 }, (_, i) =>
      makeConstraint(
        `Constraint ${i}: This is a detailed constraint with many words to push token count higher and higher until we exceed the budget significantly.`,
      ),
    );

    const result = applyTokenBudget(constraints, 200);

    expect(result.learnings.filter((l) => l.learningType === "constraint").length).toBe(10);
    expect(result.constraintBudgetExceeded).toBe(true);
  });

  it("fills remaining budget with instructions after constraints", () => {
    const learnings: LoadedLearning[] = [
      makeConstraint("Short constraint."), // ~3 tokens
      makeInstruction("First instruction that fits."), // ~7 tokens
      makeInstruction("Second instruction that fits."), // ~7 tokens
      makeInstruction("Oversized " + "word ".repeat(100)), // ~134 tokens, won't fit
    ];

    // Budget 30: constraint ~3 tokens, leaves ~27 for instructions
    const result = applyTokenBudget(learnings, 30);

    const constraints = result.learnings.filter((l) => l.learningType === "constraint");
    const instructions = result.learnings.filter((l) => l.learningType === "instruction");

    expect(constraints.length).toBe(1);
    // First two instructions fit (~7 each = ~14), oversized one skipped
    expect(instructions.length).toBe(2);
    expect(instructions.every((i) => !i.text.startsWith("Oversized"))).toBe(true);
  });

  it("skips oversized instruction and tries next one", () => {
    const learnings: LoadedLearning[] = [
      makeConstraint("Short."),
      makeInstruction(
        "Oversized instruction " + "word ".repeat(400),
        "high",
      ),
      makeInstruction("Small instruction fits.", "medium"),
    ];

    const result = applyTokenBudget(learnings, 100);

    const instructions = result.learnings.filter((l) => l.learningType === "instruction");
    expect(instructions.length).toBe(1);
    expect(instructions[0].text).toBe("Small instruction fits.");
  });

  it("includes precedents after instructions within remaining budget", () => {
    const learnings: LoadedLearning[] = [
      makeConstraint("Short."),
      makeInstruction("Brief."),
      makePrecedent("Relevant precedent.", 0.90),
    ];

    const result = applyTokenBudget(learnings, 500);

    expect(result.learnings.filter((l) => l.learningType === "precedent").length).toBe(1);
  });
});
