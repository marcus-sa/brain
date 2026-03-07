-- Graph traversal functions using SurrealQL native arrow syntax and multi-table SELECT.
-- Moves graph query logic from TypeScript into SurrealDB stored functions.

-- fn::entity_edges: All edges touching a single entity across all relation tables.
-- Used by entity detail panel to show relationships.
DEFINE FUNCTION OVERWRITE fn::entity_edges($entity: record, $lim: int) {
  RETURN SELECT id, `in`, out, kind, confidence
    FROM entity_relation, belongs_to, has_feature, has_task, has_project,
         depends_on, owns, observes, suggests_for, subtask_of
    WHERE `in` = $entity OR out = $entity
    LIMIT $lim;
};

-- fn::edges_between: All edges where both endpoints are in the given set.
-- Used by graph visualization to draw edges between known entities.
DEFINE FUNCTION OVERWRITE fn::edges_between($ids: array) {
  RETURN SELECT id, `in`, out, kind, confidence
    FROM entity_relation, belongs_to, has_feature, has_task, has_project,
         depends_on, owns, observes, suggests_for, subtask_of
    WHERE `in` IN $ids AND out IN $ids;
};

-- fn::graph_neighbors: Endpoints of all edges touching any entity in the given set.
-- Used by BFS graph traversal to expand the frontier.
DEFINE FUNCTION OVERWRITE fn::graph_neighbors($ids: array) {
  RETURN SELECT `in`, out
    FROM entity_relation, belongs_to, has_feature, has_task, has_project,
         depends_on, owns, observes, suggests_for, subtask_of
    WHERE `in` IN $ids OR out IN $ids;
};

-- fn::workspace_entity_ids: Collect all entity record IDs in a workspace via graph traversal.
-- Traverses: workspace->has_project->project->has_feature->feature->has_task->task,
--            project<-belongs_to, feature<-belongs_to, workspace<-member_of<-person,
--            plus provenance entities from extraction_relation.
DEFINE FUNCTION OVERWRITE fn::workspace_entity_ids($ws: record<workspace>) {
  LET $projects = (SELECT VALUE out FROM has_project WHERE `in` = $ws);
  LET $features = (SELECT VALUE out FROM has_feature WHERE `in` IN $projects);
  LET $tasks = (SELECT VALUE out FROM has_task WHERE `in` IN $features);
  LET $belongs_project = (SELECT VALUE `in` FROM belongs_to WHERE out IN $projects);
  LET $belongs_feature = (SELECT VALUE `in` FROM belongs_to WHERE out IN $features);
  LET $persons = (SELECT VALUE `in` FROM member_of WHERE out = $ws);
  LET $provenance = (
    SELECT VALUE out FROM extraction_relation
    WHERE `in` IN (
      SELECT VALUE id FROM message
      WHERE conversation IN (
        SELECT VALUE id FROM conversation WHERE workspace = $ws
      )
    )
  );
  RETURN array::distinct(
    $projects + $features + $tasks +
    $belongs_project + $belongs_feature +
    $persons + $provenance
  );
};

-- fn::project_entity_ids: Collect all entity record IDs in a project's subgraph.
-- Same traversal as workspace but scoped to a single project.
DEFINE FUNCTION OVERWRITE fn::project_entity_ids($ws: record<workspace>, $project: record<project>) {
  LET $features = (SELECT VALUE out FROM has_feature WHERE `in` = $project);
  LET $tasks = (SELECT VALUE out FROM has_task WHERE `in` IN $features);
  LET $belongs_project = (SELECT VALUE `in` FROM belongs_to WHERE out = $project);
  LET $belongs_feature = (SELECT VALUE `in` FROM belongs_to WHERE out IN $features);
  LET $persons = (SELECT VALUE `in` FROM member_of WHERE out = $ws);
  LET $provenance = (
    SELECT VALUE out FROM extraction_relation
    WHERE `in` IN (
      SELECT VALUE id FROM message
      WHERE conversation IN (
        SELECT VALUE id FROM conversation WHERE workspace = $ws
      )
    )
  );
  RETURN array::distinct(
    [$project] + $features + $tasks +
    $belongs_project + $belongs_feature +
    $persons + $provenance
  );
};
