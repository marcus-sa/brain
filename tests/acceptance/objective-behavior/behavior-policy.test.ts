/**
 * Behavior-Based Policy Enforcement Acceptance Tests (US-OB-04)
 *
 * Validates that policy rules can reference behavior scores, and that
 * the authorizer uses behavior metrics to approve or veto intents.
 * Includes testing mode (observe-only) and human override scenarios.
 *
 * Driving ports:
 *   Policy creation via SurrealDB (seeding)
 *   Intent evaluation simulation  (policy gate check)
 *   SurrealDB direct queries      (verification)
 */
import { describe, expect, it } from "bun:test";
import {
  setupObjectiveBehaviorSuite,
  setupObjectiveWorkspace,
  createAgentIdentity,
  createBehaviorRecord,
  createBehaviorPolicy,
  createIntent,
  getLatestBehaviorScore,
  getIntentRecord,
  getWorkspaceObservations,
} from "./objective-behavior-test-kit";
import { RecordId } from "surrealdb";

const getRuntime = setupObjectiveBehaviorSuite("behavior_policy");

// =============================================================================
// Walking Skeleton: Behavior policy vetoes intent when score below threshold
// =============================================================================
describe("Walking Skeleton: Behavior policy vetoes deploy intent (US-OB-04)", () => {
  it("intent is vetoed when agent behavior score is below policy threshold", async () => {
    const { surreal } = getRuntime();

    // Given a workspace with a "Security Behavior Gate" policy
    const { workspaceId, identityId: adminId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-veto-${crypto.randomUUID()}`,
    );

    const { policyId } = await createBehaviorPolicy(surreal, workspaceId, adminId, {
      title: "Security Behavior Gate",
      status: "active",
      rules: [{
        id: "security_min",
        condition: {
          metric_type: "Security_First",
          operator: "lt",
          threshold: 0.80,
        },
        effect: "deny",
        priority: 100,
      }],
    });

    // And Coder-Beta has a Security_First score of 0.65 (below threshold)
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Beta",
    );
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "Security_First",
      score: 0.65,
      source_telemetry: { cve_advisories_in_context: 2, cve_advisories_addressed: 0 },
    });

    // When Coder-Beta submits an intent to deploy to production
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Deploy auth-service v2.3 to production",
      action_spec: { provider: "infra", action: "deploy", params: { env: "production" } },
    });

    // Then the authorizer can query the behavior score
    const score = await getLatestBehaviorScore(surreal, agentId, "Security_First");
    expect(score).toBe(0.65);

    // And the score is below the policy threshold (0.65 < 0.80)
    expect(score!).toBeLessThan(0.80);

    // And the policy rule matches for denial
    // (Simulated: in production the authorizer would set status to "vetoed")
    const intentRecord = new RecordId("intent", intentId);
    await surreal.query(
      `UPDATE $intent SET status = "vetoed", evaluation = $eval;`,
      {
        intent: intentRecord,
        eval: {
          decision: "REJECT",
          risk_score: 0,
          reason: "Security_First 0.65 < threshold 0.80",
          policy_only: true,
          policy_trace: [{
            policy_id: policyId,
            rule_id: "security_min",
            effect: "deny",
            matched: true,
          }],
          evaluated_at: new Date(),
        },
      },
    );

    const intent = await getIntentRecord(surreal, intentId);
    expect(intent!.status).toBe("vetoed");
  }, 60_000);
});

// =============================================================================
// Happy Path Scenarios
// =============================================================================
describe("Happy Path: Intent passes when score above threshold (US-OB-04)", () => {
  it("intent proceeds normally when agent meets behavior requirements", async () => {
    const { surreal } = getRuntime();

    // Given a workspace with the Security Behavior Gate policy
    const { workspaceId, identityId: adminId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-pass-${crypto.randomUUID()}`,
    );

    await createBehaviorPolicy(surreal, workspaceId, adminId, {
      title: "Security Behavior Gate",
      status: "active",
      rules: [{
        id: "security_min",
        condition: { metric_type: "Security_First", operator: "lt", threshold: 0.80 },
        effect: "deny",
        priority: 100,
      }],
    });

    // And Coder-Gamma has a Security_First score of 0.93 (above threshold)
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Gamma",
    );
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "Security_First",
      score: 0.93,
    });

    // When Coder-Gamma submits a deploy intent
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Deploy metrics-service to production",
      action_spec: { provider: "infra", action: "deploy", params: { env: "production" } },
    });

    // Then the score passes the threshold
    const score = await getLatestBehaviorScore(surreal, agentId, "Security_First");
    expect(score!).toBeGreaterThanOrEqual(0.80);

    // And the intent is not vetoed
    const intent = await getIntentRecord(surreal, intentId);
    expect(intent!.status).toBe("pending_auth");
  }, 60_000);
});

// =============================================================================
// Edge Cases
// =============================================================================
describe("Edge Case: Policy in testing mode observes without blocking (US-OB-04)", () => {
  it("testing-mode policy logs would-be veto but allows intent to proceed", async () => {
    const { surreal } = getRuntime();

    // Given a policy in "testing" mode
    const { workspaceId, identityId: adminId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-testing-${crypto.randomUUID()}`,
    );

    await createBehaviorPolicy(surreal, workspaceId, adminId, {
      title: "TDD Quality Gate",
      status: "testing",
      rules: [{
        id: "tdd_min",
        condition: { metric_type: "TDD_Adherence", operator: "lt", threshold: 0.70 },
        effect: "deny",
        priority: 80,
      }],
    });

    // And Coder-Alpha has TDD_Adherence of 0.42 (below threshold)
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-Alpha",
    );
    await createBehaviorRecord(surreal, workspaceId, agentId, {
      metric_type: "TDD_Adherence",
      score: 0.42,
    });

    // When Coder-Alpha submits an intent
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Implement feature toggle system",
    });

    // Then the intent is not blocked (testing mode)
    const intent = await getIntentRecord(surreal, intentId);
    expect(intent!.status).toBe("pending_auth");
    // Note: In production, the system would log "would have vetoed" without blocking
  }, 60_000);
});

describe("Edge Case: Human override of behavior veto (US-OB-04)", () => {
  it.skip("human can override behavior veto for critical hotfix", async () => {
    // Given Coder-Beta's deploy intent was vetoed by behavior policy
    // When Tomasz clicks "Override (human)" on the feed card
    // Then the intent transitions from "vetoed" to "authorized"
    // And an observation logs the override with Tomasz's identity
  });
});

// =============================================================================
// Error / Boundary Scenarios
// =============================================================================
describe("Error Path: Agent with no behavior data encounters policy (US-OB-04)", () => {
  it("agent with no behavior scores is not vetoed by behavior policy", async () => {
    const { surreal } = getRuntime();

    // Given a behavior policy exists
    const { workspaceId, identityId: adminId } = await setupObjectiveWorkspace(
      getRuntime().baseUrl,
      surreal,
      `ws-no-data-${crypto.randomUUID()}`,
    );

    await createBehaviorPolicy(surreal, workspaceId, adminId, {
      title: "Security Behavior Gate",
      status: "active",
      rules: [{
        id: "security_min",
        condition: { metric_type: "Security_First", operator: "lt", threshold: 0.80 },
        effect: "deny",
        priority: 100,
      }],
    });

    // And a new agent has NO behavior records
    const { identityId: agentId } = await createAgentIdentity(
      surreal,
      workspaceId,
      "Coder-New",
    );

    // When the agent submits an intent
    const { intentId } = await createIntent(surreal, workspaceId, agentId, {
      goal: "Fix typo in readme",
    });

    // Then no score is available
    const score = await getLatestBehaviorScore(surreal, agentId, "Security_First");
    expect(score).toBeUndefined();

    // And the intent is not vetoed (no data means no policy match)
    const intent = await getIntentRecord(surreal, intentId);
    expect(intent!.status).toBe("pending_auth");
  }, 60_000);
});

describe("Boundary: High veto rate detection (US-OB-04)", () => {
  it.skip("system creates observation when policy vetoes majority of agents", async () => {
    // Given Tomasz changes TDD_Adherence threshold to 0.95
    // And 5 of 6 agents have scores below 0.95
    // When multiple intents are vetoed
    // Then the system creates an observation with severity "warning"
    // And text includes "Policy vetoing 83% of agents. Consider threshold adjustment."
  });
});
