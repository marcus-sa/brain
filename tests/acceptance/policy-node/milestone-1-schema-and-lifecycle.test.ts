/**
 * Milestone 1: Policy Schema, Lifecycle, and Graph Relations
 *
 * Traces: US-1, US-2, US-3, US-10
 *
 * Validates policy record creation with schema enforcement,
 * lifecycle state transitions (draft -> active -> deprecated),
 * graph edge creation/removal, and version immutability.
 *
 * Driving ports:
 *   Direct DB for policy CRUD and schema enforcement
 *   Graph traversal queries for relation validation
 */
import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import {
  setupOrchestratorSuite,
  createTestUser,
  createTestWorkspace,
  createTestIdentity,
  createPolicy,
  activatePolicy,
  deprecatePolicy,
  getPolicyRecord,
  createPolicyVersion,
} from "./policy-test-kit";

const getRuntime = setupOrchestratorSuite("policy_m1_schema_lifecycle");

describe("Milestone 1: Policy Schema Enforcement (US-1)", () => {
  // ---------------------------------------------------------------------------
  // US-1: Policy created with all required fields
  // AC-1 happy path
  // ---------------------------------------------------------------------------
  it("creates a policy record with title, rules, selector, and flags", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a workspace with a human admin
    const user = await createTestUser(baseUrl, "m1-create");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    // When the admin creates a policy with all fields
    const { policyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "Finance Small Spend",
      description: "Allow small financial transactions",
      selector: { resource: "banking_api" },
      rules: [{
        id: "max_spend",
        condition: { field: "budget_limit.amount", operator: "lte", value: 500 },
        effect: "allow",
        priority: 1,
      }],
      human_veto_required: false,
      max_ttl: "1h",
    });

    // Then the record is persisted with all fields
    const record = await getPolicyRecord(surreal, policyId);
    expect(record.title).toBe("Finance Small Spend");
    expect(record.version).toBe(1);
    expect(record.status).toBe("draft");
    expect(record.rules).toHaveLength(1);
    expect(record.rules[0].id).toBe("max_spend");
    expect(record.rules[0].effect).toBe("allow");
    expect(record.human_veto_required).toBe(false);
    expect(record.created_at).toBeDefined();
  }, 120_000);

  // ---------------------------------------------------------------------------
  // US-1: Schema rejects invalid effect value
  // AC-1 sad path
  // ---------------------------------------------------------------------------
  it("rejects policy creation with invalid rule effect", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "m1-bad-effect");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    // When a policy is created with an invalid effect
    const policyRecord = new RecordId("policy", `bad-${crypto.randomUUID()}`);
    let createError: Error | undefined;
    try {
      await surreal.query(`CREATE $policy CONTENT $content;`, {
        policy: policyRecord,
        content: {
          title: "Bad Policy",
          version: 1,
          status: "draft",
          selector: {},
          rules: [{
            id: "bad_rule",
            condition: { field: "action_spec.action", operator: "eq", value: "read" },
            effect: "invalid_effect",
            priority: 1,
          }],
          human_veto_required: false,
          created_by: new RecordId("identity", adminId),
          workspace: new RecordId("workspace", workspace.workspaceId),
          created_at: new Date(),
        },
      });
    } catch (e) {
      createError = e as Error;
    }

    // Then the database rejects the invalid effect value
    expect(createError).toBeDefined();
  }, 120_000);

  // ---------------------------------------------------------------------------
  // US-1: Schema rejects invalid status value
  // AC-1 sad path
  // ---------------------------------------------------------------------------
  it("rejects policy creation with invalid status", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "m1-bad-status");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    // When a policy is created with an invalid status
    const policyRecord = new RecordId("policy", `badstatus-${crypto.randomUUID()}`);
    let statusError: Error | undefined;
    try {
      await surreal.query(`CREATE $policy CONTENT $content;`, {
        policy: policyRecord,
        content: {
          title: "Bad Status Policy",
          version: 1,
          status: "invalid_status",
          selector: {},
          rules: [],
          human_veto_required: false,
          created_by: new RecordId("identity", adminId),
          workspace: new RecordId("workspace", workspace.workspaceId),
          created_at: new Date(),
        },
      });
    } catch (e) {
      statusError = e as Error;
    }

    // Then the database rejects the invalid status value
    expect(statusError).toBeDefined();
  }, 120_000);
});

describe("Milestone 1: Policy Lifecycle Management (US-2)", () => {
  // ---------------------------------------------------------------------------
  // US-2: Draft -> Active transition with audit event
  // AC-2 happy path
  // ---------------------------------------------------------------------------
  it("activates a draft policy and creates graph edges atomically", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given a draft policy
    const user = await createTestUser(baseUrl, "m1-activate");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    const { policyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "API Rate Limit Policy",
      rules: [{
        id: "rate_limit",
        condition: { field: "action_spec.action", operator: "eq", value: "api_call" },
        effect: "allow",
        priority: 10,
      }],
    });

    // When the admin activates the policy
    await activatePolicy(surreal, policyId, adminId, workspace.workspaceId);

    // Then the policy status is active
    const record = await getPolicyRecord(surreal, policyId);
    expect(record.status).toBe("active");
    expect(record.updated_at).toBeDefined();

    // And the governing edge exists (identity -> policy)
    const identityRecord = new RecordId("identity", adminId);
    const governingRows = (await surreal.query(
      `SELECT ->governing->policy AS policies FROM $identity;`,
      { identity: identityRecord },
    )) as Array<Array<{ policies: RecordId[] }>>;
    const governedPolicies = governingRows[0]?.[0]?.policies ?? [];
    const found = governedPolicies.some(p => (p.id as string) === policyId);
    expect(found).toBe(true);

    // And the protects edge exists (policy -> workspace)
    const policyRecord = new RecordId("policy", policyId);
    const protectsRows = (await surreal.query(
      `SELECT ->protects->workspace AS workspaces FROM $policy;`,
      { policy: policyRecord },
    )) as Array<Array<{ workspaces: RecordId[] }>>;
    const protectedWorkspaces = protectsRows[0]?.[0]?.workspaces ?? [];
    expect(protectedWorkspaces.length).toBeGreaterThanOrEqual(1);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // US-2: Active -> Deprecated removes edges
  // AC-2 deprecation path
  // ---------------------------------------------------------------------------
  it("deprecating a policy removes all governing and protects edges", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given an active policy with graph edges
    const user = await createTestUser(baseUrl, "m1-deprecate");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    const { policyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "Legacy Auth Policy",
      rules: [{
        id: "legacy_check",
        condition: { field: "action_spec.action", operator: "eq", value: "auth" },
        effect: "allow",
        priority: 5,
      }],
    });
    await activatePolicy(surreal, policyId, adminId, workspace.workspaceId);

    // When the admin deprecates the policy
    await deprecatePolicy(surreal, policyId);

    // Then the policy status is deprecated
    const record = await getPolicyRecord(surreal, policyId);
    expect(record.status).toBe("deprecated");

    // And the governing edges are removed
    const policyRecord = new RecordId("policy", policyId);
    const governingRows = (await surreal.query(
      `SELECT * FROM governing WHERE out = $policy;`,
      { policy: policyRecord },
    )) as Array<Array<unknown>>;
    expect(governingRows[0]).toHaveLength(0);

    // And the protects edges are removed
    const protectsRows = (await surreal.query(
      `SELECT * FROM protects WHERE in = $policy;`,
      { policy: policyRecord },
    )) as Array<Array<unknown>>;
    expect(protectsRows[0]).toHaveLength(0);
  }, 120_000);
});

describe("Milestone 1: Graph Relations (US-3)", () => {
  // ---------------------------------------------------------------------------
  // US-3: Identity-to-policy governing edge with created_at
  // AC-3
  // ---------------------------------------------------------------------------
  it("governing edge links identity to policy with created_at timestamp", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "m1-governing");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    const { policyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "Governing Edge Test",
      rules: [{
        id: "test_rule",
        condition: { field: "action_spec.action", operator: "eq", value: "test" },
        effect: "allow",
        priority: 1,
      }],
    });
    await activatePolicy(surreal, policyId, adminId, workspace.workspaceId);

    // When the governing edge is queried
    const policyRecord = new RecordId("policy", policyId);
    const rows = (await surreal.query(
      `SELECT *, created_at FROM governing WHERE out = $policy;`,
      { policy: policyRecord },
    )) as Array<Array<{ created_at: string }>>;

    // Then the edge has a created_at timestamp
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0].created_at).toBeDefined();
  }, 120_000);

  // ---------------------------------------------------------------------------
  // US-3: Policy-to-workspace protects edge with created_at
  // AC-3
  // ---------------------------------------------------------------------------
  it("protects edge links policy to workspace with created_at timestamp", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "m1-protects");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    const { policyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "Protects Edge Test",
      rules: [{
        id: "test_rule",
        condition: { field: "action_spec.action", operator: "eq", value: "test" },
        effect: "allow",
        priority: 1,
      }],
    });
    await activatePolicy(surreal, policyId, adminId, workspace.workspaceId);

    // When the protects edge is queried
    const policyRecord = new RecordId("policy", policyId);
    const rows = (await surreal.query(
      `SELECT *, created_at FROM protects WHERE in = $policy;`,
      { policy: policyRecord },
    )) as Array<Array<{ created_at: string }>>;

    // Then the edge has a created_at timestamp
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0].created_at).toBeDefined();
  }, 120_000);
});

describe("Milestone 1: Version Immutability (US-10)", () => {
  // ---------------------------------------------------------------------------
  // US-10: New version supersedes old version
  // AC-10
  // ---------------------------------------------------------------------------
  it("updating policy rules creates a new version and supersedes the old one", async () => {
    const { baseUrl, surreal } = getRuntime();

    // Given an active policy at version 1
    const user = await createTestUser(baseUrl, "m1-version");
    const workspace = await createTestWorkspace(baseUrl, user);
    const adminId = await createTestIdentity(surreal, "admin-1", "human", workspace.workspaceId);

    const { policyId: v1PolicyId } = await createPolicy(surreal, workspace.workspaceId, adminId, {
      title: "Budget Cap Policy",
      rules: [{
        id: "budget_cap",
        condition: { field: "budget_limit.amount", operator: "lte", value: 100 },
        effect: "allow",
        priority: 10,
      }],
      status: "active",
    });

    // When the admin updates the budget cap to 500
    const { policyId: v2PolicyId } = await createPolicyVersion(
      surreal,
      v1PolicyId,
      workspace.workspaceId,
      adminId,
      [{
        id: "budget_cap",
        condition: { field: "budget_limit.amount", operator: "lte", value: 500 },
        effect: "allow",
        priority: 10,
      }],
    );

    // Then the old version is superseded
    const v1Record = await getPolicyRecord(surreal, v1PolicyId);
    expect(v1Record.status).toBe("superseded");
    expect(v1Record.version).toBe(1);
    // And the old rules are unchanged (immutable)
    expect(v1Record.rules[0].condition).toEqual({
      field: "budget_limit.amount",
      operator: "lte",
      value: 100,
    });

    // And the new version is active with updated rules
    const v2Record = await getPolicyRecord(surreal, v2PolicyId);
    expect(v2Record.status).toBe("active");
    expect(v2Record.version).toBe(2);
    expect(v2Record.rules[0].condition).toEqual({
      field: "budget_limit.amount",
      operator: "lte",
      value: 500,
    });

    // And the supersedes chain is preserved
    expect(v2Record.supersedes).toBeDefined();
  }, 120_000);
});
