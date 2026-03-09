import { describe, expect, it } from "bun:test";
import { RecordId } from "surrealdb";
import { createTestUser, fetchJson, setupSmokeSuite } from "../smoke-test-kit";

/**
 * US-UI-004: Auth Rewiring -- Session and Account Migration
 *
 * Validates that the auth layer speaks "identity" instead of "person":
 * - session.identity_id replaces session.person_id
 * - account.identity_id replaces account.person_id
 * - OAuth login creates session with identity reference
 * - Session lookup resolves to identity with type context
 * - Chat ingress uses identity from session as actor
 */

const getRuntime = setupSmokeSuite("auth-rewiring");

describe.skip("US-UI-004: Auth sessions reference identity for unified actor resolution", () => {
  // -- Happy path: session carries identity_id --

  it.skip("Given a user signs up with email and password, when the session is queried, then session.identity_id references an identity record, not a person record", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "auth-identity");

    // Find the session created by sign-up
    const [sessions] = await surreal.query<
      [Array<{ identity_id: RecordId }>]
    >("SELECT identity_id FROM session LIMIT 1;");

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].identity_id).toBeDefined();
    expect((sessions[0].identity_id as RecordId).table.name).toBe("identity");
  }, 60_000);

  it.skip("Given a user has an active session with identity_id, when the identity is queried from the session, then the identity has type 'human'", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "auth-type");

    const [sessions] = await surreal.query<
      [Array<{ identity_id: RecordId }>]
    >("SELECT identity_id FROM session LIMIT 1;");

    const identityId = sessions[0].identity_id;
    const [identities] = await surreal.query<
      [Array<{ type: string; name: string }>]
    >("SELECT type, name FROM $record;", { record: identityId });

    expect(identities[0].type).toBe("human");
  }, 60_000);

  // -- Account table --

  it.skip("Given a user signs up, when the account record is queried, then account.identity_id references an identity record", async () => {
    const { baseUrl, surreal } = getRuntime();

    const user = await createTestUser(baseUrl, "auth-account");

    const [accounts] = await surreal.query<
      [Array<{ identity_id: RecordId; provider_id: string }>]
    >("SELECT identity_id, provider_id FROM account LIMIT 1;");

    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0].identity_id).toBeDefined();
    expect((accounts[0].identity_id as RecordId).table.name).toBe("identity");
  }, 60_000);

  // -- Schema completeness: no person_id remnants --

  it.skip("Given the auth rewiring migration is complete, when schema info is queried for session and account, then person_id field no longer exists and identity_id is present", async () => {
    const { surreal } = getRuntime();

    for (const table of ["session", "account"]) {
      const [info] = await surreal.query<[Record<string, unknown>]>(
        `INFO FOR TABLE ${table};`,
      );

      const fields = info as unknown as { fd: Record<string, string> };
      const fieldNames = Object.keys(fields.fd);

      expect(fieldNames).not.toContain("person_id");
      expect(fieldNames).toContain("identity_id");
    }
  }, 60_000);

  // -- OAuth tables --

  it.skip("Given the auth rewiring migration is complete, when schema info is queried for OAuth tables, then userId references identity instead of person", async () => {
    const { surreal } = getRuntime();

    const oauthTables = ["oauthClient", "oauthAccessToken", "oauthRefreshToken", "oauthConsent"];

    for (const table of oauthTables) {
      const [info] = await surreal.query<[Record<string, unknown>]>(
        `INFO FOR TABLE ${table};`,
      );

      const fields = info as unknown as { fd: Record<string, string> };
      if (fields.fd.userId) {
        expect(fields.fd.userId).not.toContain("record<person>");
        expect(fields.fd.userId).toContain("record<identity>");
      }
    }
  }, 60_000);

  // -- Chat context uses identity --

  it.skip("Given a user is logged in and has a workspace, when the user sends a chat message, then the chat pipeline processes the message using the user's identity as the actor", async () => {
    const { baseUrl } = getRuntime();

    const user = await createTestUser(baseUrl, "auth-chat");
    const workspace = await fetchJson<{ workspaceId: string; conversationId: string }>(
      `${baseUrl}/api/workspaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({ name: `Auth Chat Test ${Date.now()}` }),
      },
    );

    // Send a message - the pipeline should use identityRecord internally
    // We verify this works end-to-end (no crash from type mismatches)
    const chatResponse = await fetchJson<{ messageId: string }>(
      `${baseUrl}/api/chat/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...user.headers },
        body: JSON.stringify({
          clientMessageId: `auth-test-${Date.now()}`,
          workspaceId: workspace.workspaceId,
          conversationId: workspace.conversationId,
          text: "Hello, testing identity-based chat context.",
        }),
      },
    );

    expect(chatResponse.messageId).toBeDefined();
    expect(chatResponse.messageId.length).toBeGreaterThan(0);
  }, 60_000);

  // -- Error path: session without identity --

  it.skip("Given a session exists without an identity_id, when the chat pipeline tries to resolve the actor, then the request fails with an appropriate error rather than silently proceeding", async () => {
    const { surreal } = getRuntime();

    // Attempt to create a session without identity_id should fail at schema level
    const sessionRecord = new RecordId("session", `invalid-${Date.now()}`);

    await expect(
      surreal.query("CREATE $record CONTENT $content;", {
        record: sessionRecord,
        content: {
          token: "invalid-session-token",
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
          updated_at: new Date(),
          // Missing identity_id - should fail since it's required
        },
      }),
    ).rejects.toThrow();
  }, 60_000);
});
