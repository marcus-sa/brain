import { randomBytes } from "node:crypto";

const API_KEY_PREFIX = "brain_";
const API_KEY_BYTE_LENGTH = 32;

/** Generate a new API key with prefix. Returns the raw key (show once to user). */
export function generateApiKey(): string {
  const bytes = randomBytes(API_KEY_BYTE_LENGTH);
  return `${API_KEY_PREFIX}${bytes.toString("hex")}`;
}

/** Hash an API key for storage. Uses Bun's built-in bcrypt. */
export async function hashApiKey(key: string): Promise<string> {
  return Bun.password.hash(key, { algorithm: "bcrypt", cost: 10 });
}

/** Verify a raw API key against a stored hash. */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return Bun.password.verify(key, hash);
}
