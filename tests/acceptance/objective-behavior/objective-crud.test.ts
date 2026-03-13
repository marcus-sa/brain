/**
 * Objective CRUD Acceptance Tests (US-OB-01)
 *
 * Validates that strategic objectives can be created, read, updated,
 * and scoped to workspaces with success criteria and embeddings.
 *
 * Driving ports:
 *   POST /api/workspaces/:workspaceId/objectives  (create)
 *   GET  /api/workspaces/:workspaceId/objectives   (list)
 *   SurrealDB direct queries                       (verification)
 */
import { describe, expect, it } from "bun:test";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createObjective,
  getObjective,
  listObjectives,
} from "./objective-behavior-test-kit";

const getRuntime = setupObjectiveBehaviorSuite("objective_crud");

// =============================================================================
// Walking Skeleton: Leader creates a strategic objective and sees it in the graph
// =============================================================================
describe("Walking Skeleton: Leader creates a strategic objective (US-OB-01)", () => {
  it("objective is created with title, priority, status, and workspace scope", async () => {
    const { surreal } = getRuntime();

    // Given Elena is working in workspace "BrainOS"
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-skeleton-${crypto.randomUUID()}`,
    );

    // When Elena creates an objective for the Q2 launch
    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Launch MCP Marketplace",
      description: "Launch the MCP marketplace with 10 listed integrations by June 30",
      status: "active",
      priority: "high",
      target_date: "2026-06-30",
      success_criteria: [
        { metric_name: "listed_integrations", target_value: 10, current_value: 0, unit: "count" },
      ],
    });

    // Then the objective is persisted with all fields
    const objective = await getObjective(surreal, objectiveId);
    expect(objective).toBeDefined();
    expect(objective!.title).toBe("Launch MCP Marketplace");
    expect(objective!.status).toBe("active");
    expect(objective!.priority).toBe("high");
    expect(objective!.target_date).toBe("2026-06-30");
    expect(objective!.success_criteria).toHaveLength(1);
    expect(objective!.success_criteria[0].metric_name).toBe("listed_integrations");
    expect(objective!.success_criteria[0].target_value).toBe(10);

    // And the objective is scoped to the workspace
    expect(objective!.workspace.id).toBe(workspaceId);
  }, 60_000);
});

// =============================================================================
// Happy Path Scenarios
// =============================================================================
describe("Happy Path: Objective creation with success criteria (US-OB-01)", () => {
  it("objective stores multiple success criteria as key results", async () => {
    const { surreal } = getRuntime();

    // Given a workspace for tracking objectives
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-kpi-${crypto.randomUUID()}`,
    );

    // When an objective is created with multiple success criteria
    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      priority: "critical",
      success_criteria: [
        { metric_name: "uptime", target_value: 99.9, current_value: 98.5, unit: "percent" },
        { metric_name: "mean_time_to_recovery", target_value: 5, current_value: 45, unit: "minutes" },
        { metric_name: "error_rate", target_value: 0.1, current_value: 2.3, unit: "percent" },
      ],
    });

    // Then all success criteria are persisted
    const objective = await getObjective(surreal, objectiveId);
    expect(objective!.success_criteria).toHaveLength(3);
    expect(objective!.success_criteria.map((sc) => sc.metric_name)).toEqual(
      ["uptime", "mean_time_to_recovery", "error_rate"],
    );
  }, 60_000);

  it("objectives are listed within workspace scope", async () => {
    const { surreal } = getRuntime();

    // Given a workspace with two active objectives
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-list-${crypto.randomUUID()}`,
    );

    await createObjective(surreal, workspaceId, {
      title: "Launch MCP Marketplace",
      status: "active",
    });
    await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      status: "active",
    });

    // When Elena lists active objectives
    const objectives = await listObjectives(surreal, workspaceId, "active");

    // Then both objectives are visible
    expect(objectives).toHaveLength(2);
    const titles = objectives.map((o) => o.title);
    expect(titles).toContain("Launch MCP Marketplace");
    expect(titles).toContain("Improve Infrastructure Reliability");
  }, 60_000);
});

// =============================================================================
// Edge Cases
// =============================================================================
describe("Edge Case: Objective without target date (US-OB-01)", () => {
  it("objective is created without target date and remains valid", async () => {
    const { surreal } = getRuntime();

    // Given Elena describes an objective without a specific deadline
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-nodate-${crypto.randomUUID()}`,
    );

    // When the objective is created without a target date
    const { objectiveId } = await createObjective(surreal, workspaceId, {
      title: "Improve Infrastructure Reliability",
      status: "active",
      priority: "medium",
    });

    // Then the objective is created with undefined target_date
    const objective = await getObjective(surreal, objectiveId);
    expect(objective).toBeDefined();
    expect(objective!.title).toBe("Improve Infrastructure Reliability");
    expect(objective!.status).toBe("active");
    expect(objective!.target_date).toBeUndefined();
  }, 60_000);
});

// =============================================================================
// Error / Boundary Scenarios
// =============================================================================
describe("Boundary: Objective workspace isolation (US-OB-01)", () => {
  it("objectives in one workspace are not visible from another workspace", async () => {
    const { surreal } = getRuntime();

    // Given two separate workspaces
    const { workspaceId: wsA } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-iso-a-${crypto.randomUUID()}`,
    );
    const { workspaceId: wsB } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-iso-b-${crypto.randomUUID()}`,
    );

    // And an objective exists only in workspace A
    await createObjective(surreal, wsA, {
      title: "Launch MCP Marketplace",
      status: "active",
    });

    // When listing objectives in workspace B
    const objectivesB = await listObjectives(surreal, wsB);

    // Then no objectives are visible
    expect(objectivesB).toHaveLength(0);

    // And workspace A still has its objective
    const objectivesA = await listObjectives(surreal, wsA);
    expect(objectivesA).toHaveLength(1);
  }, 60_000);

  it.skip("duplicate objective is detected by semantic similarity above 0.95", async () => {
    // Requires embedding generation pipeline integration
    // Given objective "Launch MCP Marketplace" exists with embedding
    // When creating an objective with semantically identical title
    // Then no duplicate is created
    // And the user is informed of the existing objective
  });

  it.skip("objective status transitions follow lifecycle rules", async () => {
    // Given an active objective
    // When marking as completed
    // Then status transitions to completed with timestamp
    // When attempting to transition a completed objective back to active
    // Then the transition is rejected
  });
});
