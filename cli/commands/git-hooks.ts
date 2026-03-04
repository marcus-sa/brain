import { execSync } from "node:child_process";
import { requireConfig, getDirCacheEntry } from "../config";
import { BrainHttpClient } from "../http-client";

/**
 * brain check-commit
 * Called by pre-commit git hook.
 * Reads staged diff and checks for task completion, unlogged decisions, constraint violations.
 */
export async function runCheckCommit(): Promise<void> {
  const config = requireConfig();
  const client = new BrainHttpClient(config);
  const cwd = process.cwd();
  const cached = getDirCacheEntry(cwd);

  if (!cached) return; // No project mapped — skip silently

  let diff: string;
  let commitMessage: string;
  try {
    diff = execSync("git diff --cached", { encoding: "utf-8", cwd }).trim();
    try {
      commitMessage = execSync("cat .git/COMMIT_EDITMSG", { encoding: "utf-8", cwd }).trim();
    } catch {
      commitMessage = "";
    }
  } catch {
    return; // Not in a git repo or no staged changes
  }

  if (!diff) return;

  try {
    // Truncate for token budget
    const truncatedDiff = diff.length > 8000 ? diff.slice(0, 8000) : diff;

    const result = await client.checkCommit({
      project_id: cached.project_id,
      diff: truncatedDiff,
      commit_message: commitMessage,
    });

    // Display findings to stderr (stdout is reserved for git hook protocol)
    for (const tc of result.task_completions) {
      if (tc.confidence >= 0.6) {
        process.stderr.write(`Brain: This commit may complete: ${tc.task_title}\n`);
      }
    }
    for (const d of result.unlogged_decisions) {
      process.stderr.write(`Brain: Unlogged decision: ${d.description}\n`);
    }
    for (const v of result.constraint_violations) {
      process.stderr.write(`Brain: Constraint violation (${v.severity}): ${v.violation}\n`);
    }
  } catch {
    // Never block commits on analysis failures
  }
}

/**
 * brain log-commit
 * Called by post-commit git hook.
 * Reads the latest commit and logs it to the knowledge graph.
 */
export async function runLogCommit(): Promise<void> {
  const config = requireConfig();
  const client = new BrainHttpClient(config);
  const cwd = process.cwd();
  const cached = getDirCacheEntry(cwd);

  if (!cached) return;

  try {
    // Get commit info
    const sha = execSync("git rev-parse HEAD", { encoding: "utf-8", cwd }).trim();
    const message = execSync("git log -1 --pretty=%B", { encoding: "utf-8", cwd }).trim();
    const author = execSync("git log -1 --pretty=%an", { encoding: "utf-8", cwd }).trim();

    // Get files changed with stats
    const diffStat = execSync("git diff-tree --no-commit-id --name-status -r HEAD", { encoding: "utf-8", cwd }).trim();

    const filesChanged = diffStat
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [status, ...pathParts] = line.split("\t");
        const path = pathParts.join("\t");
        let changeType: string;
        switch (status) {
          case "A":
            changeType = "added";
            break;
          case "D":
            changeType = "deleted";
            break;
          default:
            changeType = "modified";
        }
        return { path, change_type: changeType, lines_added: 0, lines_removed: 0 };
      });

    // Get line counts
    try {
      const numstat = execSync("git diff-tree --no-commit-id --numstat -r HEAD", { encoding: "utf-8", cwd }).trim();
      const numstatLines = numstat.split("\n").filter((l) => l.trim());
      for (const line of numstatLines) {
        const [added, removed, filePath] = line.split("\t");
        const file = filesChanged.find((f) => f.path === filePath);
        if (file) {
          file.lines_added = added === "-" ? 0 : parseInt(added, 10);
          file.lines_removed = removed === "-" ? 0 : parseInt(removed, 10);
        }
      }
    } catch {
      // numstat not available — skip line counts
    }

    await client.logCommit({
      project_id: cached.project_id,
      sha,
      message,
      files_changed: filesChanged,
      author,
    });
  } catch (error) {
    // Don't block commits on logging failures
    console.error(`Brain: Failed to log commit: ${error instanceof Error ? error.message : error}`);
  }
}
