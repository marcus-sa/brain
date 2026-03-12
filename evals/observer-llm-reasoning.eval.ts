/**
 * Observer LLM Reasoning Eval
 *
 * Measures the quality of LLM-powered semantic verification in the observer pipeline.
 * Tests whether the LLM correctly identifies contradictions, matches, and ambiguous
 * relationships between decisions and tasks.
 *
 * Calls the real LLM — no mocking. Requires OBSERVER_MODEL in env.
 *
 * Scorers:
 *   verdict-accuracy     — Does the LLM verdict match the expected outcome?
 *   confidence-calibration — Is confidence well-calibrated for the scenario?
 *   reasoning-quality    — Does reasoning reference relevant entities?
 *   no-hallucination     — Does reasoning avoid forbidden patterns?
 *   factuality           — LLM judge: is reasoning factually consistent?
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { evalite } from "evalite";
import { Factuality } from "autoevals";
import { afterAll, beforeAll } from "vitest";
import { RecordId } from "surrealdb";
import {
  type EvalRuntime,
  setupEvalRuntime,
  teardownEvalRuntime,
} from "./eval-test-kit";
import { seedObserverLlmTestData, type ObserverLlmSeedResult } from "./observer-llm-reasoning-seed-data";
import { verdictAccuracyScorer } from "./scorers/verdict-accuracy";
import { confidenceCalibrationScorer } from "./scorers/confidence-calibration";
import { reasoningQualityScorer } from "./scorers/reasoning-quality";
import type { ObserverLlmTestCase, ObserverLlmEvalOutput } from "./types";
import { runObserverAgent } from "../app/src/server/agents/observer/agent";

const observerModelId = process.env.OBSERVER_MODEL;
if (!observerModelId) {
  throw new Error("OBSERVER_MODEL env var is required for observer LLM reasoning evals");
}

let runtime: EvalRuntime;
let seedResult: ObserverLlmSeedResult;

beforeAll(async () => {
  try {
    runtime = await setupEvalRuntime("observer-llm");
    seedResult = await seedObserverLlmTestData(runtime.surreal);
  } catch (error) {
    console.error("beforeAll setup failed:", error);
    throw error;
  }
}, 120_000);

afterAll(async () => {
  await teardownEvalRuntime(runtime);
}, 120_000);

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

const cases: ObserverLlmTestCase[] = [
  // --- Verification: Clear contradictions ---
  {
    id: "clear-contradiction-deps",
    evalType: "verification",
    scenario: "Task adds Redis+Kafka but decision says minimize external deps",
    seedCaseKey: "clear-contradiction",
    expectedVerdict: "mismatch",
    expectedConfidenceRange: [0.6, 1.0],
    expectedSeverity: "conflict",
    expectedReasoningAnchors: ["redis", "kafka", "external"],
    expectedFacts: "The task adds Redis and Kafka as new external service dependencies, which directly contradicts the decision to minimize external service dependencies.",
  },
  {
    id: "api-contradiction-trpc-vs-rest",
    evalType: "verification",
    scenario: "Task builds REST billing API but decision mandates tRPC",
    seedCaseKey: "api-contradiction",
    expectedVerdict: "mismatch",
    expectedConfidenceRange: [0.6, 1.0],
    expectedSeverity: "conflict",
    expectedReasoningAnchors: ["rest", "trpc"],
    expectedFacts: "The task implements a REST API with Express, which contradicts the decision to standardize on tRPC and forbid REST for new services.",
  },
  {
    id: "security-contradiction-sql",
    evalType: "verification",
    scenario: "Task uses SQL string concatenation but decision requires parameterized queries",
    seedCaseKey: "security-contradiction",
    expectedVerdict: "mismatch",
    expectedConfidenceRange: [0.6, 1.0],
    expectedSeverity: "conflict",
    expectedReasoningAnchors: ["parameterized", "concatenation"],
    expectedFacts: "The task builds SQL queries via string concatenation, which contradicts the decision requiring parameterized statements and forbidding string concatenation in SQL.",
  },
  {
    id: "format-contradiction-xml",
    evalType: "verification",
    scenario: "Task outputs XML but decision mandates JSON-only responses",
    seedCaseKey: "format-contradiction",
    expectedVerdict: "mismatch",
    expectedConfidenceRange: [0.6, 1.0],
    expectedSeverity: "conflict",
    expectedReasoningAnchors: ["xml", "json"],
    expectedFacts: "The task implements an XML export endpoint, which contradicts the decision that all API responses must use JSON format exclusively.",
  },

  // --- Verification: Clear match ---
  {
    id: "clear-match-typescript",
    evalType: "verification",
    scenario: "Task implements TypeScript middleware, decision requires TypeScript",
    seedCaseKey: "clear-match",
    expectedVerdict: "match",
    expectedConfidenceRange: [0.6, 1.0],
    expectedSeverity: "info",
    expectedReasoningAnchors: ["typescript"],
    expectedFacts: "The task implements authentication middleware in TypeScript, which aligns with the decision to use TypeScript for all backend services.",
  },

  // --- Verification: Ambiguous ---
  {
    id: "ambiguous-convention-vs-config",
    evalType: "verification",
    scenario: "Task adds config file, decision prefers convention over configuration",
    seedCaseKey: "ambiguous",
    expectedVerdict: "inconclusive",
    expectedConfidenceRange: [0.0, 0.7],
    expectedSeverity: "info",
    forbiddenReasoningPatterns: ["clearly contradicts", "severe violation"],
  },

  // --- Peer review: Grounded observation ---
  {
    id: "peer-review-grounded",
    evalType: "peer_review",
    scenario: "PM observation about blocked task with evidence edges — should be sound",
    seedCaseKey: "grounded-warning",
    expectedVerdict: "match",
    expectedConfidenceRange: [0.5, 1.0],
    expectedSeverity: "info",
    expectedReasoningAnchors: ["rate limiting", "in_progress"],
    expectedFacts: "The PM observation correctly identifies that a rate limiting task has been in progress for an extended period with no linked commits, and the related decision is still provisional.",
  },

  // --- Peer review: Ungrounded claim ---
  {
    id: "peer-review-ungrounded",
    evalType: "peer_review",
    scenario: "PM observation makes sweeping claim with no evidence edges",
    seedCaseKey: "ungrounded-claim",
    expectedVerdict: "inconclusive",
    expectedConfidenceRange: [0.0, 0.5],
    expectedSeverity: "info",
    forbiddenReasoningPatterns: ["confirmed", "verified"],
  },
];

// ---------------------------------------------------------------------------
// Task runner
// ---------------------------------------------------------------------------

async function runObserverLlmCase(testCase: ObserverLlmTestCase): Promise<ObserverLlmEvalOutput> {
  try {
    if (testCase.evalType === "verification") {
      return await runVerificationCase(testCase);
    }
    return await runPeerReviewCase(testCase);
  } catch (error) {
    return {
      caseId: testCase.id,
      verdict: "",
      reasoning: "",
      severity: "",
      evidenceRefs: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runVerificationCase(testCase: ObserverLlmTestCase): Promise<ObserverLlmEvalOutput> {
  const taskRecord = seedResult.tasks.get(testCase.seedCaseKey);
  if (!taskRecord) {
    throw new Error(`No seeded task for case key: ${testCase.seedCaseKey}`);
  }

  const result = await runObserverAgent({
    surreal: runtime.surreal,
    workspaceRecord: seedResult.workspaceRecord,
    entityTable: "task",
    entityId: taskRecord.id as string,
  });

  return {
    caseId: testCase.id,
    verdict: result.verdict,
    reasoning: result.evidence.join(" "),
    severity: result.verdict === "mismatch" ? "conflict" : "info",
    evidenceRefs: result.evidence,
    success: true,
  };
}

async function runPeerReviewCase(testCase: ObserverLlmTestCase): Promise<ObserverLlmEvalOutput> {
  const obsRecord = seedResult.observations.get(testCase.seedCaseKey);
  if (!obsRecord) {
    throw new Error(`No seeded observation for case key: ${testCase.seedCaseKey}`);
  }

  const result = await runObserverAgent({
    surreal: runtime.surreal,
    workspaceRecord: seedResult.workspaceRecord,
    entityTable: "observation",
    entityId: obsRecord.id as string,
  });

  return {
    caseId: testCase.id,
    verdict: result.verdict,
    reasoning: result.evidence.join(" "),
    severity: result.verdict === "mismatch" ? "conflict" : "info",
    evidenceRefs: result.evidence,
    success: true,
  };
}

// ---------------------------------------------------------------------------
// Eval definition
// ---------------------------------------------------------------------------

evalite<ObserverLlmTestCase, ObserverLlmEvalOutput, ObserverLlmTestCase>(
  "Observer LLM Reasoning Quality",
  {
    data: cases.map((testCase) => ({ input: testCase, expected: testCase })),
    task: async (input) => runObserverLlmCase(input),
    scorers: [
      {
        name: "verdict-accuracy",
        description: "Does the LLM verdict match the expected outcome (match/mismatch/inconclusive)?",
        scorer: verdictAccuracyScorer,
      },
      {
        name: "confidence-calibration",
        description: "Is the confidence score appropriate for the scenario clarity?",
        scorer: confidenceCalibrationScorer,
      },
      {
        name: "reasoning-quality",
        description: "Does the reasoning text reference relevant entities and decisions?",
        scorer: reasoningQualityScorer,
      },
      {
        name: "no-hallucination",
        description: "Reasoning does not contain forbidden patterns",
        scorer: ({ output, expected }) => {
          if (!expected?.forbiddenReasoningPatterns || expected.forbiddenReasoningPatterns.length === 0) return 1;
          if (!output.reasoning) return 1;
          const lowerReasoning = output.reasoning.toLowerCase();
          const violations = expected.forbiddenReasoningPatterns.filter((p) =>
            lowerReasoning.includes(p.toLowerCase()),
          );
          return violations.length === 0 ? 1 : 0;
        },
      },
      {
        name: "factuality",
        description: "LLM judge: is reasoning factually consistent with ground truth?",
        scorer: async ({ output, expected }) => {
          if (!expected?.expectedFacts || !output.success) return 1;
          const result = await Factuality({
            input: expected.scenario,
            output: output.reasoning,
            expected: expected.expectedFacts,
          });
          const score = result.score ?? 0;
          return score >= 0.4 ? 1 : 0;
        },
      },
    ],
    columns: ({ input, output, scores }) => [
      { label: "Model", value: observerModelId },
      { label: "Case", value: input.id },
      { label: "Type", value: input.evalType },
      { label: "Success", value: output.success ? "yes" : "no" },
      { label: "Verdict", value: formatScore(scores, "verdict-accuracy") },
      { label: "Confid", value: formatScore(scores, "confidence-calibration") },
      { label: "Reason", value: formatScore(scores, "reasoning-quality") },
      { label: "NoHalluc", value: formatScore(scores, "no-hallucination") },
      { label: "Factual", value: formatScore(scores, "factuality") },
    ],
  },
);

function formatScore(scores: Array<{ name: string; score: number | null }>, name: string): string {
  const match = scores.find((s) => s.name === name);
  return match?.score !== null && match?.score !== undefined ? match.score.toFixed(2) : "N/A";
}
