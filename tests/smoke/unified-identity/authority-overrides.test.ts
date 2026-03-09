import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RecordId, Surreal } from "surrealdb";

/**
 * US-UI-006: Role-Based Authority with Per-Identity Overrides
 *
 * Validates the authority resolution system:
 * - authority_scope matches on identity.role (not just agent_type)
 * - authorized_to override edges grant per-identity exceptions
 * - Resolution order: override -> role default -> blocked
 * - Human identity with humanPresent bypasses authority
 * - No role and no override returns blocked (fail-safe)
 */

const surrealUrl = process.env.SURREAL_URL ?? "ws://127.0.0.1:8000/rpc";
const surrealUsername = process.env.SURREAL_USERNAME ?? "root";
const surrealPassword = process.env.SURREAL_PASSWORD ?? "root";

let surreal: Surreal;
let namespace: string;
let database: string;
let workspaceRecord: RecordId<"workspace", string>;

beforeAll(async () => {
  const runId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  namespace = `smoke_authority_${runId}`;
  database = `authority_${Math.floor(Math.random() * 100000)}`;

  surreal = new Surreal();
  await surreal.connect(surrealUrl);
  await surreal.signin({ username: surrealUsername, password: surrealPassword });
  await surreal.query(`DEFINE NAMESPACE ${namespace};`);
  await surreal.use({ namespace });
  await surreal.query(`DEFINE DATABASE ${database};`);
  await surreal.use({ namespace, database });

  const schemaSql = readFileSync(join(process.cwd(), "schema", "surreal-schema.surql"), "utf8");
  await surreal.query(schemaSql);

  const now = new Date();

  workspaceRecord = new RecordId("workspace", randomUUID());
  await surreal.create(workspaceRecord).content({
    name: "Authority Test Workspace",
    status: "active",
    onboarding_complete: true,
    onboarding_turn_count: 0,
    onboarding_summary_pending: false,
    onboarding_started_at: now,
    created_at: now,
  });
}, 60_000);

afterAll(async () => {
  if (!surreal) return;
  try {
    await surreal.query(`REMOVE DATABASE ${database};`);
    await surreal.query(`REMOVE NAMESPACE ${namespace};`);
  } catch {}
  await surreal.close().catch(() => {});
}, 10_000);

describe("US-UI-006: Authority resolves override then role default then blocked for each identity", () => {
  // -- Happy path: role-based permission --

  it.skip("Given an agent identity with role 'management' and a role-based authority scope for 'create_task', when authority is checked, then the role default permission is returned", async () => {
    const now = new Date();
    const pmIdentity = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: pmIdentity,
      content: {
        name: "PM Agent",
        type: "agent",
        role: "management",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    // Query authority_scope by role
    const [scopes] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      `SELECT permission FROM authority_scope
       WHERE agent_type = 'management' AND action = 'create_task';`,
    );

    // management + create_task should return "auto" from seed data
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes[0].permission).toBe("auto");
  }, 60_000);

  // -- Per-identity override takes precedence --

  it.skip("Given an agent identity with role 'coder' has default 'blocked' for confirm_decision, when an authorized_to override grants 'auto' for that identity, then the override permission is returned", async () => {
    const now = new Date();
    const humanIdentity = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: humanIdentity,
      content: {
        name: "Marcus Oliveira",
        type: "human",
        role: "owner",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    const leadCoder = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: leadCoder,
      content: {
        name: "Lead Coder",
        type: "agent",
        role: "coder",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    // Verify default is "blocked" for code_agent + confirm_decision
    const [defaults] = await surreal.query<
      [Array<{ permission: string; id: RecordId }>]
    >(
      `SELECT permission, id FROM authority_scope
       WHERE agent_type = 'code_agent' AND action = 'confirm_decision';`,
    );
    expect(defaults[0].permission).toBe("blocked");

    // Create override edge
    await surreal.query(
      `RELATE $identity->authorized_to->$scope
       SET permission = 'auto', created_at = $now;`,
      { identity: leadCoder, scope: defaults[0].id, now },
    );

    // Query override for this identity
    const [overrides] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      `SELECT permission FROM authorized_to
       WHERE in = $identity;`,
      { identity: leadCoder },
    );

    expect(overrides.length).toBe(1);
    expect(overrides[0].permission).toBe("auto");
  }, 60_000);

  // -- No override: role default used --

  it.skip("Given an agent identity with role 'coder' and no authorized_to override, when authority is checked for confirm_decision, then the role default 'blocked' is returned", async () => {
    const now = new Date();
    const juniorCoder = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: juniorCoder,
      content: {
        name: "Junior Coder",
        type: "agent",
        role: "coder",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    // No override exists for this identity
    const [overrides] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      "SELECT permission FROM authorized_to WHERE in = $identity;",
      { identity: juniorCoder },
    );
    expect(overrides.length).toBe(0);

    // Role default for code_agent + confirm_decision is "blocked"
    const [defaults] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      `SELECT permission FROM authority_scope
       WHERE agent_type = 'code_agent' AND action = 'confirm_decision';`,
    );
    expect(defaults[0].permission).toBe("blocked");
  }, 60_000);

  // -- Fail-safe: no role, no override --

  it.skip("Given an identity with no role and no authorized_to overrides, when authority is checked, then no matching scope exists (fail-safe blocked)", async () => {
    const now = new Date();
    const rogueAgent = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: rogueAgent,
      content: {
        name: "Rogue Agent",
        type: "agent",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    // No override
    const [overrides] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      "SELECT permission FROM authorized_to WHERE in = $identity;",
      { identity: rogueAgent },
    );
    expect(overrides.length).toBe(0);

    // No role match (role is NONE, no agent_type match)
    const [roleScopes] = await surreal.query<
      [Array<{ permission: string }>]
    >(
      `SELECT permission FROM authority_scope
       WHERE agent_type = NONE AND action = 'create_observation';`,
    );
    expect(roleScopes.length).toBe(0);
    // Application code should interpret "no match" as blocked
  }, 60_000);

  // -- Human bypass --

  it.skip("Given a human identity with type 'human', when authority is checked with humanPresent=true, then the human bypasses authority entirely", async () => {
    const now = new Date();
    const humanIdentity = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: humanIdentity,
      content: {
        name: "Marcus Oliveira",
        type: "human",
        role: "owner",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    // Verify identity type is human
    const [rows] = await surreal.query<
      [Array<{ type: string }>]
    >("SELECT type FROM $record;", { record: humanIdentity });

    expect(rows[0].type).toBe("human");
    // Application code: if identity.type === 'human', skip authority check
  }, 60_000);

  // -- Schema: authorized_to relation exists --

  it.skip("Given the authority migration is complete, when schema info is queried, then the authorized_to relation table exists with IN identity OUT authority_scope", async () => {
    const [info] = await surreal.query<[Record<string, unknown>]>(
      "INFO FOR TABLE authorized_to;",
    );

    expect(info).toBeDefined();
    // The table should be defined as a RELATION type
    const tableInfo = info as unknown as { tb: string };
    expect(tableInfo.tb).toContain("RELATION");
  }, 60_000);

  // -- Error path: override with invalid permission value --

  it.skip("Given an authorized_to override, when the permission value is not in the allowed enum, then the creation fails", async () => {
    const now = new Date();
    const testIdentity = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: testIdentity,
      content: {
        name: "Test Agent",
        type: "agent",
        role: "management",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    const [scopes] = await surreal.query<
      [Array<{ id: RecordId }>]
    >("SELECT id FROM authority_scope LIMIT 1;");

    await expect(
      surreal.query(
        `RELATE $identity->authorized_to->$scope
         SET permission = 'invalid_perm', created_at = $now;`,
        { identity: testIdentity, scope: scopes[0].id, now },
      ),
    ).rejects.toThrow();
  }, 60_000);
});
