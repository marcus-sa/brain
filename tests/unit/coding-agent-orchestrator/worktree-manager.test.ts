import { describe, expect, test } from "bun:test";
import {
  createWorktree,
  removeWorktree,
  buildWorktreePath,
  buildBranchName,
  type WorktreeInfo,
  type WorktreeError,
  type WorktreeResult,
  type ShellExec,
} from "../../../app/src/server/orchestrator/worktree-manager";

// ---------------------------------------------------------------------------
// Shell executor stub factory
// ---------------------------------------------------------------------------

type ShellCall = { command: string; args: string[]; cwd: string };

function createShellStub(options?: {
  failOnPattern?: string;
  stderr?: string;
}): { exec: ShellExec; calls: ShellCall[] } {
  const calls: ShellCall[] = [];
  const exec: ShellExec = async (command, args, cwd) => {
    calls.push({ command, args, cwd });
    if (
      options?.failOnPattern &&
      args.some((a) => a.includes(options.failOnPattern!))
    ) {
      return {
        exitCode: 128,
        stdout: "",
        stderr: options.stderr ?? "fatal: already exists",
      };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  return { exec, calls };
}

// ---------------------------------------------------------------------------
// Pure helpers: path and branch construction
// ---------------------------------------------------------------------------

describe("Worktree Manager: path construction", () => {
  test("builds worktree path from repo root and task slug", () => {
    const path = buildWorktreePath("/repo", "fix-login-bug");
    expect(path).toBe("/repo/.brain/worktrees/agent-fix-login-bug");
  });

  test("builds branch name from task slug", () => {
    const branch = buildBranchName("fix-login-bug");
    expect(branch).toBe("agent/fix-login-bug");
  });
});

// ---------------------------------------------------------------------------
// createWorktree: acceptance — returns WorktreeInfo on success
// ---------------------------------------------------------------------------

describe("Worktree Manager: createWorktree", () => {
  test("returns worktree path and branch name on success", async () => {
    const { exec } = createShellStub();

    const result = await createWorktree(exec, "/repo", "fix-login-bug");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.worktreePath).toBe(
        "/repo/.brain/worktrees/agent-fix-login-bug",
      );
      expect(result.value.branchName).toBe("agent/fix-login-bug");
    }
  });

  test("invokes git worktree add with correct arguments", async () => {
    const { exec, calls } = createShellStub();

    await createWorktree(exec, "/repo", "fix-login-bug");

    expect(calls.length).toBe(1);
    const call = calls[0];
    expect(call.command).toBe("git");
    expect(call.args).toEqual([
      "worktree",
      "add",
      "-b",
      "agent/fix-login-bug",
      ".brain/worktrees/agent-fix-login-bug",
    ]);
    expect(call.cwd).toBe("/repo");
  });

  test("returns error when worktree already exists", async () => {
    const { exec } = createShellStub({
      failOnPattern: "worktree",
      stderr: "fatal: 'agent-fix-login-bug' already exists",
    });

    const result = await createWorktree(exec, "/repo", "fix-login-bug");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WORKTREE_EXISTS");
      expect(result.error.message).toContain("already exists");
    }
  });

  test("returns error on unexpected git failure", async () => {
    const { exec } = createShellStub({
      failOnPattern: "worktree",
      stderr: "fatal: not a git repository",
    });

    const result = await createWorktree(exec, "/repo", "fix-login-bug");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("GIT_ERROR");
    }
  });
});

// ---------------------------------------------------------------------------
// removeWorktree: idempotent removal
// ---------------------------------------------------------------------------

describe("Worktree Manager: removeWorktree", () => {
  test("removes worktree and deletes branch", async () => {
    const { exec, calls } = createShellStub();

    const result = await removeWorktree(exec, "/repo", "agent/fix-login-bug");

    expect(result.ok).toBe(true);
    // Should issue two git commands: worktree remove + branch delete
    expect(calls.length).toBe(2);
    expect(calls[0].args).toEqual([
      "worktree",
      "remove",
      ".brain/worktrees/agent-fix-login-bug",
      "--force",
    ]);
    expect(calls[1].args).toEqual(["branch", "-D", "agent/fix-login-bug"]);
  });

  test("succeeds even when worktree is already removed", async () => {
    const { exec } = createShellStub({
      failOnPattern: "worktree",
      stderr: "fatal: not a valid directory",
    });

    const result = await removeWorktree(exec, "/repo", "agent/fix-login-bug");

    // Idempotent: no error
    expect(result.ok).toBe(true);
  });
});
