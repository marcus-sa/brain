import { describe, expect, it } from "bun:test";
import { validateRepoPath } from "../../../app/src/server/workspace/validate-repo-path";
import type { ShellExecResult } from "../../../app/src/server/orchestrator/worktree-manager";

// ---------------------------------------------------------------------------
// Stub factory: create a ShellExec that returns a predetermined result
// ---------------------------------------------------------------------------

type ShellExec = (
  command: string,
  args: string[],
  cwd: string,
) => Promise<ShellExecResult>;

function shellExecStub(exitCode: number, stdout = "", stderr = ""): ShellExec {
  return async (_command, _args, _cwd) => ({ exitCode, stdout, stderr });
}

// ---------------------------------------------------------------------------
// validateRepoPath — pure function with injected shell execution
// ---------------------------------------------------------------------------

describe("validateRepoPath", () => {
  it("returns ok when git rev-parse exits 0", async () => {
    const exec = shellExecStub(0, ".git\n");

    const result = await validateRepoPath("/valid/repo", exec);

    expect(result).toEqual({ ok: true });
  });

  it("returns error when git rev-parse exits non-zero (non-git directory)", async () => {
    const exec = shellExecStub(128, "", "fatal: not a git repository");

    const result = await validateRepoPath("/not/a/repo", exec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not a valid git repository");
    }
  });

  it("returns error when path does not exist (exec throws)", async () => {
    const exec: ShellExec = async () => {
      throw new Error("ENOENT: no such file or directory");
    };

    const result = await validateRepoPath("/nonexistent/path", exec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("path");
    }
  });

  it("passes correct git command arguments", async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const exec: ShellExec = async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      return { exitCode: 0, stdout: ".git\n", stderr: "" };
    };

    await validateRepoPath("/my/repo", exec);

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("git");
    expect(calls[0].args).toEqual(["-C", "/my/repo", "rev-parse", "--git-dir"]);
    expect(calls[0].cwd).toBe("/my/repo");
  });
});
