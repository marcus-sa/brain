/**
 * Objective CRUD Queries
 *
 * Pure database query functions for the objective table.
 * All functions accept Surreal + RecordId params and return typed results.
 * Embedding generation is handled by the caller using the existing pipeline.
 */
import { RecordId, type Surreal } from "surrealdb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ObjectiveStatus = "draft" | "active" | "completed" | "archived" | "expired";
export type ObjectivePriority = "low" | "medium" | "high" | "critical";

export type SuccessCriterion = {
  metric_name: string;
  target_value: number;
  current_value: number;
  unit: string;
};

export type ObjectiveRecord = {
  id: RecordId<"objective">;
  title: string;
  description?: string;
  status: ObjectiveStatus;
  priority: ObjectivePriority;
  target_date?: string;
  success_criteria: SuccessCriterion[];
  workspace: RecordId<"workspace">;
  source_message?: RecordId<"message">;
  created_by?: RecordId<"identity">;
  embedding?: number[];
  created_at: string;
  updated_at?: string;
};

export type CreateObjectiveParams = {
  title: string;
  description?: string;
  status?: ObjectiveStatus;
  priority?: ObjectivePriority;
  target_date?: string;
  success_criteria?: SuccessCriterion[];
  source_message?: RecordId<"message">;
  created_by?: RecordId<"identity">;
  embedding?: number[];
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createObjective(
  surreal: Surreal,
  workspaceId: string,
  params: CreateObjectiveParams,
): Promise<{ objectiveId: string }> {
  const objectiveId = crypto.randomUUID();
  const objectiveRecord = new RecordId("objective", objectiveId);
  const workspaceRecord = new RecordId("workspace", workspaceId);

  const content: Record<string, unknown> = {
    title: params.title,
    status: params.status ?? "active",
    priority: params.priority ?? "medium",
    success_criteria: params.success_criteria ?? [],
    workspace: workspaceRecord,
    created_at: new Date(),
  };

  if (params.description !== undefined) content.description = params.description;
  if (params.target_date !== undefined) content.target_date = params.target_date;
  if (params.source_message !== undefined) content.source_message = params.source_message;
  if (params.created_by !== undefined) content.created_by = params.created_by;
  if (params.embedding !== undefined) content.embedding = params.embedding;

  await surreal.query(`CREATE $objective CONTENT $content;`, {
    objective: objectiveRecord,
    content,
  });

  return { objectiveId };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getObjective(
  surreal: Surreal,
  objectiveId: string,
): Promise<ObjectiveRecord | undefined> {
  const objectiveRecord = new RecordId("objective", objectiveId);
  const rows = (await surreal.query(`SELECT * FROM $objective;`, {
    objective: objectiveRecord,
  })) as Array<ObjectiveRecord[]>;
  return rows[0]?.[0];
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listObjectives(
  surreal: Surreal,
  workspaceId: string,
  status?: ObjectiveStatus,
): Promise<ObjectiveRecord[]> {
  const workspaceRecord = new RecordId("workspace", workspaceId);

  if (status) {
    const rows = (await surreal.query(
      `SELECT * FROM objective WHERE workspace = $ws AND status = $status ORDER BY created_at DESC;`,
      { ws: workspaceRecord, status },
    )) as Array<ObjectiveRecord[]>;
    return rows[0] ?? [];
  }

  const rows = (await surreal.query(
    `SELECT * FROM objective WHERE workspace = $ws ORDER BY created_at DESC;`,
    { ws: workspaceRecord },
  )) as Array<ObjectiveRecord[]>;
  return rows[0] ?? [];
}

// ---------------------------------------------------------------------------
// Update Status
// ---------------------------------------------------------------------------

export async function updateObjectiveStatus(
  surreal: Surreal,
  objectiveId: string,
  status: ObjectiveStatus,
): Promise<void> {
  const objectiveRecord = new RecordId("objective", objectiveId);
  await surreal.query(`UPDATE $objective SET status = $status, updated_at = time::now();`, {
    objective: objectiveRecord,
    status,
  });
}

// ---------------------------------------------------------------------------
// Update Success Criteria
// ---------------------------------------------------------------------------

export async function updateSuccessCriteria(
  surreal: Surreal,
  objectiveId: string,
  successCriteria: SuccessCriterion[],
): Promise<void> {
  const objectiveRecord = new RecordId("objective", objectiveId);
  await surreal.query(
    `UPDATE $objective SET success_criteria = $criteria, updated_at = time::now();`,
    { objective: objectiveRecord, criteria: successCriteria },
  );
}

// ---------------------------------------------------------------------------
// Link to Project/Workspace
// ---------------------------------------------------------------------------

export async function linkObjectiveToOwner(
  surreal: Surreal,
  ownerTable: "project" | "workspace",
  ownerId: string,
  objectiveId: string,
): Promise<void> {
  const ownerRecord = new RecordId(ownerTable, ownerId);
  const objectiveRecord = new RecordId("objective", objectiveId);
  await surreal.query(
    `RELATE $owner->has_objective->$objective SET added_at = time::now();`,
    { owner: ownerRecord, objective: objectiveRecord },
  );
}
