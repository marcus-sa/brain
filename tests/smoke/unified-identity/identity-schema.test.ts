import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RecordId, Surreal } from "surrealdb";

/**
 * US-UI-001: Identity Hub and Spoke Schema
 *
 * Validates the foundational schema layer:
 * - identity table accepts human, agent, system types
 * - agent spoke table enforces managed_by as record<identity>
 * - identity_person and identity_agent spoke edges exist as TYPE RELATION
 * - Invalid identity types are rejected at schema level
 * - person.identities field has been removed
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
  namespace = `smoke_identity_schema_${runId}`;
  database = `schema_${Math.floor(Math.random() * 100000)}`;

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
    name: "Schema Test Workspace",
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

describe("US-UI-001: Identity hub-spoke schema validates all actor types", () => {
  // -- Happy path: identity creation --

  it.skip("Given a workspace exists, when a human identity is created with name, type, role, and workspace, then the record is persisted with a created_at timestamp", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());

    await surreal.query("CREATE $record CONTENT $content;", {
      record: identityRecord,
      content: {
        name: "Marcus Oliveira",
        type: "human",
        role: "owner",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    const [rows] = await surreal.query<
      [Array<{ name: string; type: string; role: string; created_at: string }>]
    >("SELECT name, type, role, created_at FROM $record;", { record: identityRecord });

    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Marcus Oliveira");
    expect(rows[0].type).toBe("human");
    expect(rows[0].role).toBe("owner");
    expect(rows[0].created_at).toBeDefined();
  }, 60_000);

  it.skip("Given a workspace exists, when an agent identity is created with type 'agent' and role 'management', then the record is persisted with type 'agent'", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());

    await surreal.query("CREATE $record CONTENT $content;", {
      record: identityRecord,
      content: {
        name: "PM Agent",
        type: "agent",
        role: "management",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    const [rows] = await surreal.query<[Array<{ type: string }>]>(
      "SELECT type FROM $record;",
      { record: identityRecord },
    );
    expect(rows[0].type).toBe("agent");
  }, 60_000);

  it.skip("Given a workspace exists, when a system identity is created with type 'system', then the record is persisted", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());

    await surreal.query("CREATE $record CONTENT $content;", {
      record: identityRecord,
      content: {
        name: "Scheduled Job Runner",
        type: "system",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    const [rows] = await surreal.query<[Array<{ type: string; name: string }>]>(
      "SELECT type, name FROM $record;",
      { record: identityRecord },
    );
    expect(rows[0].type).toBe("system");
    expect(rows[0].name).toBe("Scheduled Job Runner");
  }, 60_000);

  // -- Agent spoke table --

  it.skip("Given a human identity exists, when an agent spoke record is created with managed_by referencing that identity, then the spoke is persisted with the managed_by reference", async () => {
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

    const agentRecord = new RecordId("agent", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: agentRecord,
      content: {
        agent_type: "management",
        model: "claude-sonnet-4-20250514",
        managed_by: humanIdentity,
        created_at: now,
      },
    });

    const [rows] = await surreal.query<
      [Array<{ agent_type: string; managed_by: RecordId }>]
    >("SELECT agent_type, managed_by FROM $record;", { record: agentRecord });

    expect(rows[0].agent_type).toBe("management");
    expect(rows[0].managed_by).toBeDefined();
  }, 60_000);

  // -- Spoke edges --

  it.skip("Given an identity and a person both exist, when an identity_person spoke edge is created, then traversal from identity via the edge returns the person", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());
    const personRecord = new RecordId("person", randomUUID());

    await surreal.query("CREATE $record CONTENT $content;", {
      record: identityRecord,
      content: {
        name: "Ana Torres",
        type: "human",
        role: "owner",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    await surreal.query("CREATE $record CONTENT $content;", {
      record: personRecord,
      content: {
        name: "Ana Torres",
        contact_email: "ana@conductor.dev",
        created_at: now,
        updated_at: now,
      },
    });

    await surreal.query(
      "RELATE $identity->identity_person->$person SET added_at = $now;",
      { identity: identityRecord, person: personRecord, now },
    );

    const [result] = await surreal.query<
      [Array<{ spoke: Array<{ name: string }> }>]
    >(
      "SELECT ->identity_person->person.{ name } AS spoke FROM $record;",
      { record: identityRecord },
    );

    expect(result[0].spoke.length).toBe(1);
    expect(result[0].spoke[0].name).toBe("Ana Torres");
  }, 60_000);

  it.skip("Given an identity and an agent spoke both exist, when an identity_agent spoke edge is created, then traversal from identity via the edge returns the agent spoke", async () => {
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

    const agentRecord = new RecordId("agent", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: agentRecord,
      content: {
        agent_type: "management",
        managed_by: humanIdentity,
        created_at: now,
      },
    });

    const agentIdentity = new RecordId("identity", randomUUID());
    await surreal.query("CREATE $record CONTENT $content;", {
      record: agentIdentity,
      content: {
        name: "PM Agent",
        type: "agent",
        role: "management",
        workspace: workspaceRecord,
        created_at: now,
      },
    });

    await surreal.query(
      "RELATE $identity->identity_agent->$agent SET added_at = $now;",
      { identity: agentIdentity, agent: agentRecord, now },
    );

    const [result] = await surreal.query<
      [Array<{ spoke: Array<{ agent_type: string }> }>]
    >(
      "SELECT ->identity_agent->agent.{ agent_type } AS spoke FROM $record;",
      { record: agentIdentity },
    );

    expect(result[0].spoke.length).toBe(1);
    expect(result[0].spoke[0].agent_type).toBe("management");
  }, 60_000);

  // -- Error paths: schema enforcement --

  it.skip("Given a workspace exists, when an identity is created with invalid type 'bot', then the creation fails with a schema validation error", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());

    await expect(
      surreal.query("CREATE $record CONTENT $content;", {
        record: identityRecord,
        content: {
          name: "Invalid Bot",
          type: "bot",
          workspace: workspaceRecord,
          created_at: now,
        },
      }),
    ).rejects.toThrow();
  }, 60_000);

  it.skip("Given a workspace exists, when an identity is created without a required name field, then the creation fails", async () => {
    const now = new Date();
    const identityRecord = new RecordId("identity", randomUUID());

    await expect(
      surreal.query("CREATE $record CONTENT $content;", {
        record: identityRecord,
        content: {
          type: "human",
          workspace: workspaceRecord,
          created_at: now,
        },
      }),
    ).rejects.toThrow();
  }, 60_000);

  it.skip("Given no identity exists, when an agent spoke is created without managed_by, then the creation fails", async () => {
    const now = new Date();
    const agentRecord = new RecordId("agent", randomUUID());

    await expect(
      surreal.query("CREATE $record CONTENT $content;", {
        record: agentRecord,
        content: {
          agent_type: "management",
          created_at: now,
        },
      }),
    ).rejects.toThrow();
  }, 60_000);

  // -- Boundary: person.identities field removed --

  it.skip("Given the migration has been applied, when schema info is queried for the person table, then the identities field no longer exists", async () => {
    const [info] = await surreal.query<[Record<string, unknown>]>(
      "INFO FOR TABLE person;",
    );

    const fields = info as unknown as { fd: Record<string, string> };
    const fieldNames = Object.keys(fields.fd);

    expect(fieldNames).not.toContain("identities");
    expect(fieldNames).not.toContain("identities[*].provider");
    expect(fieldNames).not.toContain("identities[*].id");
  }, 60_000);

  // -- Boundary: indexes exist --

  it.skip("Given the migration has been applied, when schema info is queried for the identity table, then workspace and type+workspace indexes exist", async () => {
    const [info] = await surreal.query<[Record<string, unknown>]>(
      "INFO FOR TABLE identity;",
    );

    const indexes = info as unknown as { ix: Record<string, string> };
    const indexNames = Object.keys(indexes.ix);

    expect(indexNames).toContain("identity_workspace");
    expect(indexNames).toContain("identity_type_workspace");
  }, 60_000);
});
