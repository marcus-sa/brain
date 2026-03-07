import type { ShellExecResult } from "../orchestrator/worktree-manager";

// ---------------------------------------------------------------------------
// Port: shell execution dependency (injected, not imported)
// ---------------------------------------------------------------------------

type ShellExec = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<ShellExecResult>;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type RepoPathValidation =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// validateRepoPath — pure function with injected shell exec
// ---------------------------------------------------------------------------

export async function validateRepoPath(
  path: string,
  shellExec: ShellExec,
): Promise<RepoPathValidation> {
  try {
    const result = await shellExec(
      "git",
      ["-C", path, "rev-parse", "--git-dir"],
      path,
    );

    if (result.exitCode === 0) {
      return { ok: true };
    }

    return { ok: false, error: `${path} is not a valid git repository` };
  } catch {
    return { ok: false, error: `path does not exist or is not accessible: ${path}` };
  }
}
