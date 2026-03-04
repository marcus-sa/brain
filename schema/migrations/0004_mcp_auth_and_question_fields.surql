-- MCP auth and question coding agent fields.
-- Adds api_key_hash to workspace for MCP API key auth.
-- Adds asked_by, options, answer_summary, blocking_task to question for coding agent integration.

BEGIN TRANSACTION;

-- Workspace: API key hash for MCP auth
ALTER TABLE workspace ADD FIELD api_key_hash TYPE option<string>;

-- Question: coding agent fields
ALTER TABLE question ADD FIELD asked_by TYPE option<string>;
ALTER TABLE question ADD FIELD options TYPE option<array<string>>;
ALTER TABLE question ADD FIELD answer_summary TYPE option<string>;
ALTER TABLE question ADD FIELD blocking_task TYPE option<record<task>>;

COMMIT TRANSACTION;
