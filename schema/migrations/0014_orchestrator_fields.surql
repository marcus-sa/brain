BEGIN TRANSACTION;

DEFINE FIELD OVERWRITE opencode_session_id ON agent_session TYPE option<string>;
DEFINE FIELD OVERWRITE orchestrator_status ON agent_session TYPE option<string>
  ASSERT $value IS NONE OR $value IN ["spawning", "active", "idle", "completed", "aborted", "error"];
DEFINE FIELD OVERWRITE worktree_branch ON agent_session TYPE option<string>;
DEFINE FIELD OVERWRITE worktree_path ON agent_session TYPE option<string>;
DEFINE FIELD OVERWRITE stream_id ON agent_session TYPE option<string>;
DEFINE FIELD OVERWRITE last_event_at ON agent_session TYPE option<datetime>;
DEFINE FIELD OVERWRITE error_message ON agent_session TYPE option<string>;

DEFINE INDEX OVERWRITE agent_session_task_active ON agent_session FIELDS task_id, orchestrator_status;

COMMIT TRANSACTION;
