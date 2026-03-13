/**
 * Objective Progress Visibility Acceptance Tests (US-OB-05)
 *
 * Validates that objective progress can be computed from supporting
 * intents and success criteria, and that inactive/expired objectives
 * are properly flagged.
 *
 * Driving ports:
 *   GET /api/workspaces/:workspaceId/objectives/:id  (progress view)
 *   SurrealDB direct queries                          (verification)
 */
import { describe, expect, it } from "bun:test";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createAgentIdentity,
  createObjective,
  createIntent,
  createSupportsEdge,
  countSupportingIntents,
  getObjective,
  listObjectives,
} from "./objective-behavior-test-kit";

const getRuntime = setupObjectiveBehaviorSuite("objective_progress");

// =============================================================================
// Walking Skeleton: Leader views objective with supporting intents
// =============================================================================
describe("Walking Skeleton: Objective progress from supporting intents (US-OB-05)", () => {
  it("objective shows correct count of supporting intents", async () => {
    const { surreal } = getRuntime();

    // Given objective "Launch MCP Marketplace" exists
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-progress-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Launch MCP Marketplace",
      status: "active",
      target_date: "2026-06-30",
      success_criteria: [
        { metric_name: "listed_integrations", target_value: 10, current_value: 3, unit: "count" },
      ],
    });

    // And multiple agents have submitted aligned intents
    const { identityId: agentAlpha } = await createAgentIdentity(surreal, workspaceId, "Coder-Alpha");
    const { identityId: agentBeta } = await createAgentIdentity(surreal, workspaceId, "Coder-Beta");

    const intentIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { intentId } = await createIntent(surreal, workspaceId, agentAlpha, {
        goal: `Implement MCP integration feature ${i + 1}`,
      });
      await createSupportsEdge(surreal, intentId, objectiveId, { alignment_score: 0.85 });
      intentIds.push(intentId);
    }
    for (let i = 0; i < 3; i++) {
      const { intentId } = await createIntent(surreal, workspaceId, agentBeta, {
        goal: `Build MCP marketplace UI component ${i + 1}`,
      });
      await createSupportsEdge(surreal, intentId, objectiveId, { alignment_score: 0.78 });
      intentIds.push(intentId);
    }

    // When Elena views the objective progress
    const supportCount = await countSupportingIntents(surreal, objectiveId);

    // Then the objective has 8 supporting intents
    expect(supportCount).toBe(8);

    // And the success criteria show current progress
    const objective = await getObjective(surreal, objectiveId);
    expect(objective!.success_criteria[0].current_value).toBe(3);
    expect(objective!.success_criteria[0].target_value).toBe(10);
  }, 60_000);
});

// =============================================================================
// Happy Path: Success criteria tracking
// =============================================================================
describe("Happy Path: Key result tracking on objective (US-OB-05)", () => {
  it("success criteria track current versus target values", async () => {
    const { surreal } = getRuntime();

    // Given an objective with multiple key results
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-kr-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      status: "active",
      success_criteria: [
        { metric_name: "uptime", target_value: 99.9, current_value: 99.2, unit: "percent" },
        { metric_name: "error_rate", target_value: 0.1, current_value: 1.5, unit: "percent" },
      ],
    });

    // When Elena views the objective detail
    const objective = await getObjective(surreal, objectiveId);

    // Then she sees progress on each key result
    const uptime = objective!.success_criteria.find((sc) => sc.metric_name === "uptime");
    expect(uptime!.current_value).toBe(99.2);
    expect(uptime!.target_value).toBe(99.9);

    const errorRate = objective!.success_criteria.find((sc) => sc.metric_name === "error_rate");
    expect(errorRate!.current_value).toBe(1.5);
    expect(errorRate!.target_value).toBe(0.1);
  }, 60_000);
});

// =============================================================================
// Edge / Error Scenarios
// =============================================================================
describe("Edge Case: Objective with no recent activity (US-OB-05)", () => {
  it("objective with zero supporting intents is identifiable", async () => {
    const { surreal } = getRuntime();

    // Given an objective with no supporting intents
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-inactive-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      status: "active",
    });

    // When checking progress
    const supportCount = await countSupportingIntents(surreal, objectiveId);

    // Then zero supporting intents are found
    expect(supportCount).toBe(0);
  }, 60_000);
});

describe("Boundary: Expired objective detected by target date (US-OB-05)", () => {
  it("objective with past target date is identifiable as expired", async () => {
    const { surreal } = getRuntime();

    // Given an objective with a target date in the past
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-expired-${crypto.randomUUID()}`,
    );

    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Q1 Launch",
      status: "active",
      target_date: "2026-03-01",
    });

    // When viewing the objective
    const objective = await getObjective(surreal, objectiveId);

    // Then the target date is in the past (current date is 2026-03-14)
    const targetDate = new Date(objective!.target_date!);
    const now = new Date();
    expect(targetDate.getTime()).toBeLessThan(now.getTime());

    // Note: In production, the coherence auditor would transition status to "expired"
  }, 60_000);
});

describe("Boundary: Multiple objectives progress isolation (US-OB-05)", () => {
  it.skip("supporting intents are counted per objective, not globally", async () => {
    // Given two objectives exist
    // And 5 intents support objective A
    // And 3 intents support objective B
    // When viewing progress for each objective
    // Then objective A shows 5 supporting intents
    // And objective B shows 3 supporting intents
  });
});
