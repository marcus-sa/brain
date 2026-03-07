# Shared Artifacts Registry: Claude Agent SDK Migration

| Artifact | Source | Consumers | Description |
|----------|--------|-----------|-------------|
| `${worktreePath}` | `createWorktree()` | `query()` options.cwd, worktree cleanup | Git worktree directory for isolated agent work |
| `${agentSessionId}` | `createAgentSession()` | DB record, handle registry, event iteration | Unique session identifier |
| `${streamId}` | `generateStreamId()` | SSE registry, event bridge, browser client | SSE stream identifier for browser connection |
| `${taskId}` | API request body | Assignment validation, query prompt, hooks | Brain task being worked on |
| `${brainBaseUrl}` | Server config | Hook callbacks (HTTP calls to Brain API) | Brain server URL for hook API calls |
| `${authToken}` | Session/workspace config | Hook callbacks (Authorization header) | JWT for Brain API authentication |
| `${abortController}` | Created per session | `query()` options, abort handler | Controls agent process lifecycle |
| `${mcpServerConfig}` | Built from brainBaseUrl | `query()` options.mcpServers | Brain MCP server stdio configuration |
| `${hookCallbacks}` | Built from brainBaseUrl + authToken | `query()` options.hooks | TypeScript hook functions for all 6 lifecycle events |
