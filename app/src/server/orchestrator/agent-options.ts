// ---------------------------------------------------------------------------
// Agent spawn configuration and options builder
// ---------------------------------------------------------------------------

export type AgentSpawnConfig = {
  prompt: string;
  workDir: string;
  workspaceId: string;
  brainBaseUrl: string;
  systemPrompt?: string;
};

type McpServerConfig = {
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
};

export type AgentQueryOptions = {
  prompt: string;
  options: {
    cwd: string;
    maxTurns: number;
    allowedTools: string[];
    systemPrompt?: string;
    mcpServers: Record<string, McpServerConfig>;
    abortController?: AbortController;
  };
};

// ---------------------------------------------------------------------------
// buildAgentOptions — pure function mapping config to SDK query options
// ---------------------------------------------------------------------------

const ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Bash",
  "Glob",
  "Grep",
] as const;

const MAX_TURNS = 200;

export function buildAgentOptions(
  config: AgentSpawnConfig,
  abortController?: AbortController,
): AgentQueryOptions {
  return {
    prompt: config.prompt,
    options: {
      cwd: config.workDir,
      maxTurns: MAX_TURNS,
      allowedTools: [...ALLOWED_TOOLS],
      ...(config.systemPrompt !== undefined
        ? { systemPrompt: config.systemPrompt }
        : {}),
      mcpServers: {
        brain: {
          type: "stdio",
          command: "brain",
          args: ["mcp"],
          env: {
            BRAIN_SERVER_URL: config.brainBaseUrl,
            BRAIN_WORKSPACE_ID: config.workspaceId,
          },
        },
      },
      ...(abortController !== undefined ? { abortController } : {}),
    },
  };
}
