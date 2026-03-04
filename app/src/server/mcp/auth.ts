import { RecordId, type Surreal } from "surrealdb";
import { verifyApiKey } from "./api-key";
import { jsonError } from "../http/response";

type WorkspaceRow = {
  id: RecordId<"workspace", string>;
  name: string;
  api_key_hash?: string;
};

export type McpAuthResult = {
  workspaceRecord: RecordId<"workspace", string>;
  workspaceName: string;
};

/**
 * Authenticate an MCP request via Bearer token.
 * Checks the Authorization header against workspace API key hashes.
 * Returns workspace context on success, or an error Response.
 */
export async function authenticateMcpRequest(
  request: Request,
  workspaceId: string,
  surreal: Surreal,
): Promise<McpAuthResult | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError("missing or invalid Authorization header", 401);
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey) {
    return jsonError("empty API key", 401);
  }

  const workspaceRecord = new RecordId("workspace", workspaceId);
  const workspace = await surreal.select<WorkspaceRow>(workspaceRecord);
  if (!workspace) {
    return jsonError("workspace not found", 404);
  }

  if (!workspace.api_key_hash) {
    return jsonError("workspace has no API key configured — run brain init", 403);
  }

  const valid = await verifyApiKey(apiKey, workspace.api_key_hash);
  if (!valid) {
    return jsonError("invalid API key", 401);
  }

  return {
    workspaceRecord,
    workspaceName: workspace.name,
  };
}
