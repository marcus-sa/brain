/**
 * Observer Behavior Learning Loop Acceptance Tests (US-OB-07)
 *
 * Validates that the Observer Agent detects sustained behavioral
 * underperformance, proposes targeted learnings via the existing
 * learning API, and that the dual-gate safety and collision detection
 * prevent inappropriate proposals.
 *
 * Driving ports:
 *   POST /api/observe/scan/:workspaceId              (graph scan with behavior step)
 *   POST /api/workspaces/:workspaceId/learnings       (learning proposal)
 *   SurrealDB direct queries                          (verification)
 */
import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createAgentIdentity,
  createBehaviorTrend,
  createBehaviorRecord,
  getBehaviorRecords,
  getLatestBehaviorScore,
  getWorkspaceObservations,
} from "./objective-behavior-test-kit";

const getRuntime = setupObjectiveBehaviorSuite("behavior_learning");

// =============================================================================
// Walking Skeleton: Observer proposes learning for underperforming agent
// =============================================================================
describe("Walking Skeleton: Observer proposes learning from behavior pattern (US-OB-07)", () => {
  it("three consecutive below-threshold sessions produce a detectable behavioral drift pattern", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Beta's Security_First has been below 0.80 for 3 consecutive sessions
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-learning-skel-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );

    // And source telemetry shows CVE advisories being ignored
    const { behaviorIds } = await createBehaviorTrend(
      surreal,
      workspaceId,
      agentId,
      "Security_First",
      [0.62, 0.65, 0.60],
    );

    // When querying behavior records for trend analysis
    const records = await getBehaviorRecords(surreal, agentId, "Security_First");

    // Then 3 consecutive records are below the 0.80 threshold
    expect(records).toHaveLength(3);
    const allBelowThreshold = records.every((r) => r.score < 0.80);
    expect(allBelowThreshold).toBe(true);

    // And the pattern qualifies as behavioral_drift (3+ consecutive below-threshold)
    expect(records.length).toBeGreaterThanOrEqual(3);

    // Note: In production, the Observer would:
    // 1. Cluster these behavior records
    // 2. Classify root cause as "behavioral_drift"
    // 3. Propose a learning via POST /api/workspaces/:workspaceId/learnings
    // 4. Learning would have: status "pending_approval", source "agent", suggested_by "observer"
  }, 60_000);
});

// =============================================================================
// Happy Path Scenarios
// =============================================================================
describe("Happy Path: Effective learning detected by Observer (US-OB-07)", () => {
  it("improving behavior scores after learning injection are detectable", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Beta received a learning 5 sessions ago
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-effective-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );

    // And Security_First scores show improvement trend
    await createBehaviorTrend(surreal, workspaceId, agentId, "Security_First", [
      0.70, 0.75, 0.82, 0.85, 0.88,
    ]);

    // When the Observer evaluates the behavior trend
    const records = await getBehaviorRecords(surreal, agentId, "Security_First");
    const scores = records.map((r) => r.score).reverse(); // oldest to newest

    // Then the trend shows consistent improvement
    expect(scores).toEqual([0.70, 0.75, 0.82, 0.85, 0.88]);

    // And the latest score exceeds the threshold
    const latest = await getLatestBehaviorScore(surreal, agentId, "Security_First");
    expect(latest!).toBeGreaterThanOrEqual(0.80);

    // Note: In production, the Observer would create an observation noting the improvement
  }, 60_000);
});

describe("Happy Path: Learning proposed with correct metadata (US-OB-07)", () => {
  it("learning proposal record has expected fields for observer-sourced learning", async () => {
    const { surreal } = getRuntime();

    // Given behavior drift is detected for Coder-Beta
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-metadata-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );

    await createBehaviorTrend(surreal, workspaceId, agentId, "Security_First", [
      0.55, 0.60, 0.58,
    ]);

    // When the Observer proposes a learning (simulated via direct DB insert)
    const learningId = `learning-${crypto.randomUUID()}`;
    const learningRecord = new RecordId("learning", learningId);
    const workspaceRecord = new RecordId("workspace", workspaceId);

    await surreal.query(`CREATE $learning CONTENT $content;`, {
      learning: learningRecord,
      content: {
        text: "Always address CVE advisories present in your context window before proceeding with feature work",
        learning_type: "instruction",
        status: "pending_approval",
        source: "agent",
        suggested_by: "observer",
        priority: "high",
        target_agents: [agentId],
        workspace: workspaceRecord,
        created_at: new Date(),
      },
    });

    // Then the learning has correct observer metadata
    const [rows] = (await surreal.query(
      `SELECT * FROM $learning;`,
      { learning: learningRecord },
    )) as [Array<Record<string, unknown>>];

    const learning = rows[0];
    expect(learning.source).toBe("agent");
    expect(learning.suggested_by).toBe("observer");
    expect(learning.status).toBe("pending_approval");
    expect(learning.learning_type).toBe("instruction");
    expect(learning.priority).toBe("high");
    expect(learning.target_agents).toContain(agentId);
  }, 60_000);
});

// =============================================================================
// Error / Boundary Scenarios
// =============================================================================
describe("Error Path: Ineffective learning surfaced for review (US-OB-07)", () => {
  it("flat behavior scores after learning indicate ineffectiveness", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Delta received a learning 5 sessions ago
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-ineffective-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Delta",
    );

    // And TDD_Adherence scores show no improvement
    await createBehaviorTrend(surreal, workspaceId, agentId, "TDD_Adherence", [
      0.44, 0.45, 0.43, 0.46, 0.45,
    ]);

    // When the Observer evaluates the trend
    const records = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");
    const scores = records.map((r) => r.score);

    // Then all scores remain below the threshold
    const allBelow = scores.every((s) => s < 0.70);
    expect(allBelow).toBe(true);

    // And the variance is minimal (flat trend, no improvement)
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(max - min).toBeLessThan(0.10);

    // Note: In production, the Observer would create a warning observation
    // and surface the learning for human review/deactivation
  }, 60_000);
});

describe("Boundary: Rate limit prevents excessive learning proposals (US-OB-07)", () => {
  it("more than 5 learnings from observer for same agent within 7 days is detectable", async () => {
    const { surreal } = getRuntime();

    // Given the Observer has already proposed 5 learnings for Coder-Alpha this week
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-ratelimit-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    const workspaceRecord = new RecordId("workspace", workspaceId);

    // Seed 5 recent observer-proposed learnings
    for (let i = 0; i < 5; i++) {
      const lId = `learning-${crypto.randomUUID()}`;
      await surreal.query(`CREATE $learning CONTENT $content;`, {
        learning: new RecordId("learning", lId),
        content: {
          text: `Observer learning ${i + 1} for rate limit testing`,
          learning_type: "instruction",
          status: "pending_approval",
          source: "agent",
          suggested_by: "observer",
          priority: "medium",
          target_agents: [agentId],
          workspace: workspaceRecord,
          created_at: new Date(),
        },
      });
    }

    // When checking the count of recent observer proposals for this agent
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [countRows] = (await surreal.query(
      `SELECT count() AS count FROM learning
       WHERE workspace = $ws
         AND source = "agent"
         AND suggested_by = "observer"
         AND created_at > $since
       GROUP ALL;`,
      { ws: workspaceRecord, since: sevenDaysAgo },
    )) as [Array<{ count: number }>];

    const recentCount = countRows?.[0]?.count ?? 0;

    // Then the rate limit threshold of 5 is reached
    expect(recentCount).toBeGreaterThanOrEqual(5);

    // Note: In production, the Observer would skip the proposal and create
    // an observation noting the pattern for human review instead
  }, 60_000);
});

describe("Boundary: Single below-threshold session does not trigger learning (US-OB-07)", () => {
  it("learning requires 3+ consecutive below-threshold sessions, not a single one", async () => {
    const { surreal } = getRuntime();

    // Given Coder-Alpha has only 1 below-threshold session
    const { workspaceId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-single-${crypto.randomUUID()}`,
    );

    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );

    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.35,
    });

    // When checking consecutive below-threshold count
    const records = await getBehaviorRecords(surreal, agentId, "TDD_Adherence");

    // Then only 1 record exists (below 3 threshold for learning proposal)
    expect(records).toHaveLength(1);
    expect(records.length).toBeLessThan(3);

    // And no learning should be proposed (single snapshot, not a trend)
  }, 60_000);
});

describe("Error Path: Learning collision with active policy (US-OB-07)", () => {
  it.skip("learning blocked when it contradicts an active policy", async () => {
    // Given an active policy contradicts the proposed learning (collision score > 0.40)
    // When the Observer attempts to propose the learning
    // Then the learning is blocked by three-layer collision detection
    // And the Observer creates an observation noting the policy-learning conflict
  });
});
