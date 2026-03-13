/**
 * Behavioral Telemetry Collection Acceptance Tests (US-OB-03)
 *
 * Validates that behavior records are created per agent session with
 * metric_type, score, source_telemetry, and exhibits edge linking
 * identity to behavior. Records are append-only and immutable.
 *
 * Driving ports:
 *   SurrealDB direct queries  (behavior creation + verification)
 *   Observer graph scan        (telemetry evaluation trigger)
 */
import { describe, expect, it } from "bun:test";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createAgentIdentity,
  createBehaviorRecord,
  createBehaviorTrend,
  getBehaviorRecords,
  getLatestBehaviorScore,
  attemptBehaviorUpdate,
} from "./objective-behavior-test-kit";

const getRuntime = setupObjectiveBehaviorSuite("behavior_telemetry");

// =============================================================================
// Walking Skeleton: Observer records agent behavior after session
// =============================================================================
describe("Walking Skeleton: Observer records TDD adherence after agent session (US-OB-03)", () => {
  it("behavior record is created with metric type, score, and exhibits edge", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Alpha is a coding agent in the workspace
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-beh-skel-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    // When the observer evaluates Coder-Alpha's session telemetry
    // (12 files changed, only 2 test files -- low TDD adherence)
    const { behaviorId } = await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.42,
      source_telemetry: {
        files_changed: 12,
        test_files_changed: 2,
        coverage_delta: -8,
      },
    });

    // Then a behavior record exists with the correct metric and score
    const records = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");
    expect(records).toHaveLength(1);
    expect(records[0].metric_type).toBe("TDD_Adherence");
    expect(records[0].score).toBe(0.42);

    // And the source telemetry is preserved
    expect(records[0].source_telemetry).toEqual({
      files_changed: 12,
      test_files_changed: 2,
      coverage_delta: -8,
    });

    // And the behavior is scoped to the workspace
    expect(records[0].workspace.id).toBe(workspaceId);
  }, 60_000);
});

// =============================================================================
// Happy Path Scenarios
// =============================================================================
describe("Happy Path: Multiple behavior metrics per agent (US-OB-03)", () => {
  it("observer records Security_First behavior alongside TDD_Adherence", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Beta is a coding agent
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-multi-beh-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );

    // When the observer evaluates session telemetry for security behavior
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "Security_First",
      score: 0.65,
      source_telemetry: {
        cve_advisories_in_context: 2,
        cve_advisories_addressed: 1,
      },
    });

    // And also records TDD adherence for the same session
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.78,
      source_telemetry: {
        files_changed: 8,
        test_files_changed: 5,
      },
    });

    // Then both metrics are recorded for this agent
    const securityRecords = await getBehaviorRecords(surreal, agentId, "Security_First");
    expect(securityRecords).toHaveLength(1);
    expect(securityRecords[0].score).toBe(0.65);

    const tddRecords = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");
    expect(tddRecords).toHaveLength(1);
    expect(tddRecords[0].score).toBe(0.78);
  }, 60_000);

  it("behavior trend is visible across multiple sessions", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Alpha has completed 5 sessions over the past week
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-trend-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    // When behavior records accumulate over time
    await createBehaviorTrend(surreal, workspaceId, agentId, "TDD_Adherence", [
      0.40, 0.45, 0.50, 0.55, 0.60,
    ]);

    // Then all 5 records are retrievable for trend analysis
    const records = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");
    expect(records).toHaveLength(5);

    // And the latest score reflects the most recent session
    const latestScore = await getLatestBehaviorScore(surreal, agentId, "TDD_Adherence");
    expect(latestScore).toBe(0.60);
  }, 60_000);
});

// =============================================================================
// Error / Boundary Scenarios
// =============================================================================
describe("Boundary: Behavior records are append-only (US-OB-03)", () => {
  it("new sessions create new records rather than updating existing ones", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Alpha has an existing behavior record
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-append-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.42,
    });

    // When a second session produces a different score
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.55,
    });

    // Then both records exist (append-only, not overwritten)
    const records = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");
    expect(records).toHaveLength(2);
    const scores = records.map((r) => r.score).sort();
    expect(scores).toEqual([0.42, 0.55]);
  }, 60_000);
});

describe("Boundary: New agent with no behavior data (US-OB-03)", () => {
  it("agent with no sessions has empty behavior records", async () => {
    const { surreal } = getRuntime();

    // Given a newly added agent with no completed sessions
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-new-agent-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-New",
    );

    // When querying behavior data for this agent
    const records = await getBehaviorRecords(surreal, agentId);

    // Then no behavior records exist
    expect(records).toHaveLength(0);

    // And latest score is undefined
    const score = await getLatestBehaviorScore(surreal, agentId, "TDD_Adherence");
    expect(score).toBeUndefined();
  }, 60_000);
});

describe("Error Path: Behavior score validation (US-OB-03)", () => {
  it("behavior score is within valid range 0.0 to 1.0", async () => {
    const { surreal } = getRuntime();

    // Given a coding agent in the workspace
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-score-range-${crypto.randomUUID()}`,
    );
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    // When recording a valid boundary score of 0.0
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.0,
    });

    // And a valid boundary score of 1.0
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "Security_First",
      score: 1.0,
    });

    // Then both boundary scores are accepted
    const tddScore = await getLatestBehaviorScore(surreal, agentId, "TDD_Adherence");
    expect(tddScore).toBe(0.0);

    const secScore = await getLatestBehaviorScore(surreal, agentId, "Security_First");
    expect(secScore).toBe(1.0);
  }, 60_000);

  it.skip("telemetry unavailability does not block the agent session", async () => {
    // Given Coder-Alpha completes a session
    // And the telemetry source is unavailable
    // When the Observer Agent attempts evaluation
    // Then no behavior record is written
    // And the agent session was not blocked or delayed
  });
});
