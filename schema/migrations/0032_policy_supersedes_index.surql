-- Add a non-unique index on supersedes for efficient lookup during
-- atomic version creation (the transaction guards concurrency, not the index).
BEGIN TRANSACTION;
  DEFINE INDEX OVERWRITE policy_supersedes ON policy FIELDS supersedes;
COMMIT TRANSACTION;
