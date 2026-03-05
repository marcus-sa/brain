import { RecordId, type Surreal } from "surrealdb";

export async function resolveIdentity(input: {
  surreal: Surreal;
  provider: string;
  providerId: string;
  workspaceRecord: RecordId<"workspace", string>;
}): Promise<RecordId<"person", string> | undefined> {
  const [rows] = await input.surreal.query<[Array<{ id: RecordId<"person", string> }>]>(
    `SELECT id FROM person
     WHERE id IN (SELECT VALUE \`in\` FROM member_of WHERE out = $workspace)
       AND identities[WHERE provider = $provider AND id = $providerId]
     LIMIT 1;`,
    {
      workspace: input.workspaceRecord,
      provider: input.provider,
      providerId: input.providerId,
    },
  );

  return rows.length > 0 ? rows[0].id : undefined;
}

export async function resolveByEmail(input: {
  surreal: Surreal;
  email: string;
  workspaceRecord: RecordId<"workspace", string>;
}): Promise<RecordId<"person", string> | undefined> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail.length === 0) return undefined;

  const [rows] = await input.surreal.query<[Array<{ id: RecordId<"person", string> }>]>(
    `SELECT id FROM person
     WHERE id IN (SELECT VALUE \`in\` FROM member_of WHERE out = $workspace)
       AND string::lowercase(contact_email) = $email
     LIMIT 1;`,
    {
      workspace: input.workspaceRecord,
      email: normalizedEmail,
    },
  );

  return rows.length > 0 ? rows[0].id : undefined;
}
