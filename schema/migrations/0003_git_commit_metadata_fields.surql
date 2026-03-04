-- Add commit metadata fields used by MCP commit logging.

BEGIN TRANSACTION;

DEFINE FIELD author_name ON git_commit TYPE string;

COMMIT TRANSACTION;
