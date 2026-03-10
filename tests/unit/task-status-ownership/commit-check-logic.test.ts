import { describe, expect, it } from "bun:test";
import {
  processCommitTaskRefs,
  type BatchCompleteTasksPort,
  type TaskExistsPort,
} from "../../../app/src/server/mcp/commit-check";

/**
 * Unit tests for commit-check orchestration logic.
 *
 * Tests the pure pipeline: extract task IDs from commit message -> batch complete tasks.
 * Uses function stubs for ports (batchCompleteTasks, taskExists).
 */

function createBatchCompleteSpy(): { port: BatchCompleteTasksPort; calls: string[][] } {
  const calls: string[][] = [];
  const port: BatchCompleteTasksPort = async (taskIds) => {
    calls.push(taskIds);
    return taskIds.map((id) => ({ task_id: id, status: "done", updated: true }));
  };
  return { port, calls };
}

function createTaskExistsPort(existingIds: Set<string>): TaskExistsPort {
  return async (taskId) => existingIds.has(taskId);
}

describe("processCommitTaskRefs", () => {
  it("Given a commit message with task:abc123, When processed, Then task abc123 is set to done", async () => {
    const { port: batchCompleteTasks, calls } = createBatchCompleteSpy();
    const taskExists = createTaskExistsPort(new Set(["abc-1234"]));

    const result = await processCommitTaskRefs({
      commitMessage: "Implement login flow\n\ntask:abc-1234",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toEqual([
      { task_id: "abc-1234", status: "done", updated: true },
    ]);
    expect(calls).toEqual([["abc-1234"]]);
  });

  it("Given a commit with tasks: abc, def, When processed, Then both tasks are completed in a single batch", async () => {
    const { port: batchCompleteTasks, calls } = createBatchCompleteSpy();
    const taskExists = createTaskExistsPort(new Set(["abc-1234", "def-5678"]));

    const result = await processCommitTaskRefs({
      commitMessage: "Batch update\n\ntasks: abc-1234, def-5678",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toHaveLength(2);
    // Single batch call with both IDs
    expect(calls).toEqual([["abc-1234", "def-5678"]]);
  });

  it("Given a commit with no task refs, When processed, Then returns empty list", async () => {
    const { port: batchCompleteTasks, calls } = createBatchCompleteSpy();
    const taskExists = createTaskExistsPort(new Set());

    const result = await processCommitTaskRefs({
      commitMessage: "Fix typo in README",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("Given a task ref that does not exist in DB, When processed, Then it is skipped without error", async () => {
    const { port: batchCompleteTasks, calls } = createBatchCompleteSpy();
    const taskExists = createTaskExistsPort(new Set()); // no tasks exist

    const result = await processCommitTaskRefs({
      commitMessage: "task:nonexistent-9999 some work",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("Given mixed existing and non-existing task refs, When processed, Then only existing tasks are updated", async () => {
    const { port: batchCompleteTasks, calls } = createBatchCompleteSpy();
    const taskExists = createTaskExistsPort(new Set(["real-task-1"]));

    const result = await processCommitTaskRefs({
      commitMessage: "task:real-task-1 task:fake-task-2",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toHaveLength(1);
    expect(result.updatedTasks[0]?.task_id).toBe("real-task-1");
    expect(calls).toEqual([["real-task-1"]]);
  });

  it("Given an already-done task, When batchCompleteTasks returns updated:false, Then it still appears in results (idempotent)", async () => {
    const batchCompleteTasks: BatchCompleteTasksPort = async (taskIds) => {
      return taskIds.map((id) => ({ task_id: id, status: "done", updated: false }));
    };
    const taskExists = createTaskExistsPort(new Set(["done-task-1"]));

    const result = await processCommitTaskRefs({
      commitMessage: "task:done-task-1 followup",
      batchCompleteTasks,
      taskExists,
    });

    expect(result.updatedTasks).toHaveLength(1);
    expect(result.updatedTasks[0]?.task_id).toBe("done-task-1");
  });
});
