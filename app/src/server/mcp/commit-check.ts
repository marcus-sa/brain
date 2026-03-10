import { extractReferencedTaskIds } from "../webhook/commit-task-refs";

// ---------------------------------------------------------------------------
// Port types (function signatures as hexagonal ports)
// ---------------------------------------------------------------------------

export type UpdateTaskResult = {
  task_id: string;
  status: string;
  updated: boolean;
};

/** Port: check whether a task exists in the workspace. */
export type TaskExistsPort = (taskId: string) => Promise<boolean>;

/** Port: batch-complete tasks in a single transaction. */
export type BatchCompleteTasksPort = (
  taskIds: string[],
) => Promise<UpdateTaskResult[]>;

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

export type CommitCheckInput = {
  commitMessage: string;
  batchCompleteTasks: BatchCompleteTasksPort;
  taskExists: TaskExistsPort;
};

export type CommitCheckResult = {
  updatedTasks: UpdateTaskResult[];
};

/**
 * Process a commit message to extract task references and transition
 * matched tasks to "done".
 *
 * Pipeline:
 *   commitMessage -> extractReferencedTaskIds (regex) -> filter existing -> batch complete -> results
 */
export async function processCommitTaskRefs(
  input: CommitCheckInput,
): Promise<CommitCheckResult> {
  const taskIds = extractReferencedTaskIds(input.commitMessage);

  if (taskIds.length === 0) {
    return { updatedTasks: [] };
  }

  // Filter to only tasks that exist in this workspace
  const existenceChecks = await Promise.all(
    taskIds.map(async (id) => ({ id, exists: await input.taskExists(id) })),
  );
  const existingTaskIds = existenceChecks
    .filter((check) => check.exists)
    .map((check) => check.id);

  if (existingTaskIds.length === 0) {
    return { updatedTasks: [] };
  }

  const updatedTasks = await input.batchCompleteTasks(existingTaskIds);

  return { updatedTasks };
}
