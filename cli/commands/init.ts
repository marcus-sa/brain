import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { saveConfig } from "../config";
import { BrainHttpClient } from "../http-client";

const DEFAULT_SERVER_URL = "http://localhost:3000";

export async function runInit(): Promise<void> {
  const serverUrl = process.env.BRAIN_SERVER_URL ?? DEFAULT_SERVER_URL;

  console.log("Connecting to Brain server...\n");

  // Fetch workspaces — for now, use the default workspace
  // In future: prompt for workspace selection
  const workspaceId = process.env.BRAIN_WORKSPACE_ID;
  if (!workspaceId) {
    console.error("Set BRAIN_WORKSPACE_ID env var to your workspace ID.");
    console.error("Find it in the Brain web UI or the database.");
    process.exit(1);
  }

  try {
    // Generate API key
    const initResult = await BrainHttpClient.initApiKey(serverUrl, workspaceId);

    // Save config
    saveConfig({
      server_url: serverUrl,
      workspace: workspaceId,
      api_key: initResult.api_key,
    });

    // Install git hooks
    installGitHooks();

    console.log(`Connected to workspace: ${initResult.workspace.name} (${workspaceId})\n`);
    console.log("Configuration saved to ~/.brain/config.json");
    console.log("Plugin hooks active:");
    console.log("  SessionStart  -> infers project, loads context");
    console.log("  UserPromptSubmit -> checks for updates");
    console.log("  Stop          -> catches unlogged decisions + questions");
    console.log("  SessionEnd    -> logs session to graph");
    console.log("");
    console.log("Git hooks installed:");
    console.log("  pre-commit    -> checks if commit resolves tasks");
    console.log("  post-commit   -> logs commit to graph");
  } catch (error) {
    console.error("Failed to connect:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function installGitHooks(): void {
  // Find .git directory by walking up
  let dir = process.cwd();
  let gitDir: string | undefined;

  while (dir !== "/") {
    const candidate = join(dir, ".git");
    if (existsSync(candidate)) {
      gitDir = candidate;
      break;
    }
    dir = join(dir, "..");
  }

  if (!gitDir) {
    console.log("\nNo .git directory found — skipping git hook installation.");
    return;
  }

  const hooksDir = join(gitDir, "hooks");
  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true });
  }

  const preCommitPath = join(hooksDir, "pre-commit");
  const postCommitPath = join(hooksDir, "post-commit");

  const preCommitScript = `#!/bin/sh
# Brain pre-commit hook: check for task completion and unlogged decisions
brain check-commit
`;

  const postCommitScript = `#!/bin/sh
# Brain post-commit hook: log commit to knowledge graph
brain log-commit
`;

  // Only install if no existing hook
  if (!existsSync(preCommitPath)) {
    writeFileSync(preCommitPath, preCommitScript);
    chmodSync(preCommitPath, 0o755);
  } else {
    console.log("  pre-commit hook already exists — skipping");
  }

  if (!existsSync(postCommitPath)) {
    writeFileSync(postCommitPath, postCommitScript);
    chmodSync(postCommitPath, 0o755);
  } else {
    console.log("  post-commit hook already exists — skipping");
  }
}
