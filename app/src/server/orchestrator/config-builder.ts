// ---------------------------------------------------------------------------
// OpenCode config builder — pure function, no side effects
// ---------------------------------------------------------------------------

export type OpencodeConfig = {
  mcpServers: Record<string, { url: string; headers: Record<string, string> }>;
  model: { provider: string; model: string };
  permissions: { autoApprove: string[] };
};

export type ConfigInput = {
  brainBaseUrl: string;
  workspaceId: string;
  authToken: string;
  modelProvider?: string;
  modelName?: string;
};

const DEFAULT_MODEL_PROVIDER = "anthropic";
const DEFAULT_MODEL_NAME = "claude-sonnet-4-20250514";
const AUTO_APPROVE_PERMISSIONS = ["read", "write", "edit", "bash"];

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildMcpUrl(baseUrl: string, workspaceId: string): string {
  return `${stripTrailingSlash(baseUrl)}/api/mcp/${workspaceId}`;
}

function buildAuthHeaders(authToken: string): Record<string, string> {
  return { Authorization: `Bearer ${authToken}` };
}

export function buildOpencodeConfig(input: ConfigInput): OpencodeConfig {
  return {
    mcpServers: {
      brain: {
        url: buildMcpUrl(input.brainBaseUrl, input.workspaceId),
        headers: buildAuthHeaders(input.authToken),
      },
    },
    model: {
      provider: input.modelProvider ?? DEFAULT_MODEL_PROVIDER,
      model: input.modelName ?? DEFAULT_MODEL_NAME,
    },
    permissions: {
      autoApprove: AUTO_APPROVE_PERMISSIONS,
    },
  };
}
