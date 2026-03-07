// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorktreeInfo = {
  worktreePath: string;
  branchName: string;
};

export type DiffResult = {
  files: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }>;
  rawDiff: string;
  stats: { filesChanged: number; insertions: number; deletions: number };
};

export type WorktreeErrorCode = "WORKTREE_EXISTS" | "GIT_ERROR";

export type WorktreeError = {
  code: WorktreeErrorCode;
  message: string;
};

export type WorktreeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorktreeError };

// ---------------------------------------------------------------------------
// Shell executor port (injected dependency)
// ---------------------------------------------------------------------------

export type ShellExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ShellExec = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<ShellExecResult>;

// ---------------------------------------------------------------------------
// Pure helpers: path and branch construction
// ---------------------------------------------------------------------------

const WORKTREE_DIR = ".brain/worktrees";
const BRANCH_PREFIX = "agent/";
const WORKTREE_PREFIX = "agent-";

export function buildWorktreePath(repoRoot: string, taskSlug: string): string {
  return `${repoRoot}/${WORKTREE_DIR}/${WORKTREE_PREFIX}${taskSlug}`;
}

export function buildBranchName(taskSlug: string): string {
  return `${BRANCH_PREFIX}${taskSlug}`;
}

function worktreeRelativePath(taskSlug: string): string {
  return `${WORKTREE_DIR}/${WORKTREE_PREFIX}${taskSlug}`;
}

function taskSlugFromBranch(branchName: string): string {
  return branchName.replace(BRANCH_PREFIX, "");
}

// ---------------------------------------------------------------------------
// Error constructors
// ---------------------------------------------------------------------------

function worktreeExists(stderr: string): WorktreeResult<never> {
  return {
    ok: false,
    error: {
      code: "WORKTREE_EXISTS",
      message: `Worktree already exists: ${stderr}`,
    },
  };
}

function gitError(stderr: string): WorktreeResult<never> {
  return {
    ok: false,
    error: {
      code: "GIT_ERROR",
      message: `Git command failed: ${stderr}`,
    },
  };
}

// ---------------------------------------------------------------------------
// createWorktree — creates worktree with new branch
// ---------------------------------------------------------------------------

export async function createWorktree(
  exec: ShellExec,
  repoRoot: string,
  taskSlug: string,
): Promise<WorktreeResult<WorktreeInfo>> {
  const branchName = buildBranchName(taskSlug);
  const relativePath = worktreeRelativePath(taskSlug);

  const result = await exec(
    "git",
    ["worktree", "add", "-b", branchName, relativePath],
    repoRoot,
  );

  if (result.exitCode !== 0) {
    if (result.stderr.includes("already exists")) {
      return worktreeExists(result.stderr);
    }
    return gitError(result.stderr);
  }

  return {
    ok: true,
    value: {
      worktreePath: buildWorktreePath(repoRoot, taskSlug),
      branchName,
    },
  };
}

// ---------------------------------------------------------------------------
// removeWorktree — idempotent removal of worktree and branch
// ---------------------------------------------------------------------------

export async function removeWorktree(
  exec: ShellExec,
  repoRoot: string,
  branchName: string,
): Promise<WorktreeResult<void>> {
  const taskSlug = taskSlugFromBranch(branchName);
  const relativePath = worktreeRelativePath(taskSlug);

  // Remove worktree (ignore failure — idempotent)
  await exec(
    "git",
    ["worktree", "remove", relativePath, "--force"],
    repoRoot,
  );

  // Delete branch (ignore failure — idempotent)
  await exec("git", ["branch", "-D", branchName], repoRoot);

  return { ok: true, value: undefined };
}

// ---------------------------------------------------------------------------
// getDiff — stub signature for step 02-02
// ---------------------------------------------------------------------------

export async function getDiff(
  _exec: ShellExec,
  _repoRoot: string,
  _branchName: string,
): Promise<WorktreeResult<DiffResult>> {
  throw new Error("Not implemented — will be implemented in step 02-02");
}
