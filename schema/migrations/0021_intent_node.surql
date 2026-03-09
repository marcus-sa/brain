-- Migration 0021: Intent node table, relations, event, and authority scope seeds
-- Adds the intent governance table for agent action authorization,
-- relation tables (triggered_by, gates, vetoed_by), a pending_auth event,
-- and authority_scope seeds for intent lifecycle actions.

-- Intent table
DEFINE TABLE OVERWRITE intent SCHEMAFULL;

-- Core fields
DEFINE FIELD OVERWRITE goal ON intent TYPE string;
DEFINE FIELD OVERWRITE reasoning ON intent TYPE string;
DEFINE FIELD OVERWRITE status ON intent TYPE string
  ASSERT $value IN ["draft", "pending_auth", "pending_veto", "authorized", "executing", "completed", "vetoed", "failed"];
DEFINE FIELD OVERWRITE priority ON intent TYPE int
  ASSERT $value >= 0 AND $value <= 100;

-- Action specification
DEFINE FIELD OVERWRITE action_spec ON intent TYPE object;
DEFINE FIELD OVERWRITE action_spec.provider ON intent TYPE string;
DEFINE FIELD OVERWRITE action_spec.action ON intent TYPE string;
DEFINE FIELD OVERWRITE action_spec.params ON intent TYPE option<object>;

-- Budget constraint
DEFINE FIELD OVERWRITE budget_limit ON intent TYPE option<object>;
DEFINE FIELD OVERWRITE budget_limit.amount ON intent TYPE float;
DEFINE FIELD OVERWRITE budget_limit.currency ON intent TYPE string;

-- Evaluation result (populated by authorizer)
DEFINE FIELD OVERWRITE evaluation ON intent TYPE option<object>;
DEFINE FIELD OVERWRITE evaluation.decision ON intent TYPE string
  ASSERT $value IN ["APPROVE", "REJECT"];
DEFINE FIELD OVERWRITE evaluation.risk_score ON intent TYPE int
  ASSERT $value >= 0 AND $value <= 100;
DEFINE FIELD OVERWRITE evaluation.reason ON intent TYPE string;
DEFINE FIELD OVERWRITE evaluation.evaluated_at ON intent TYPE datetime;
DEFINE FIELD OVERWRITE evaluation.policy_only ON intent TYPE bool;

-- Veto window
DEFINE FIELD OVERWRITE veto_expires_at ON intent TYPE option<datetime>;
DEFINE FIELD OVERWRITE veto_reason ON intent TYPE option<string>;

-- Error tracking
DEFINE FIELD OVERWRITE error_reason ON intent TYPE option<string>;

-- Traceability
DEFINE FIELD OVERWRITE trace_id ON intent TYPE string;
DEFINE FIELD OVERWRITE requester ON intent TYPE record<identity>;
DEFINE FIELD OVERWRITE workspace ON intent TYPE record<workspace>;
DEFINE FIELD OVERWRITE created_at ON intent TYPE datetime;
DEFINE FIELD OVERWRITE updated_at ON intent TYPE option<datetime>;
DEFINE FIELD OVERWRITE expiry ON intent TYPE option<datetime>;

-- Indexes
DEFINE INDEX OVERWRITE intent_workspace_status ON intent FIELDS workspace, status;
DEFINE INDEX OVERWRITE intent_created_at ON intent FIELDS created_at;
DEFINE INDEX OVERWRITE intent_trace_id ON intent FIELDS trace_id;
DEFINE INDEX OVERWRITE intent_veto_expires ON intent FIELDS veto_expires_at;

-- Relations

DEFINE TABLE OVERWRITE triggered_by TYPE RELATION IN intent OUT task SCHEMAFULL;
DEFINE FIELD OVERWRITE created_at ON triggered_by TYPE datetime;

DEFINE TABLE OVERWRITE gates TYPE RELATION IN intent OUT agent_session SCHEMAFULL;
DEFINE FIELD OVERWRITE created_at ON gates TYPE datetime;

DEFINE TABLE OVERWRITE vetoed_by TYPE RELATION IN identity OUT intent SCHEMAFULL;
DEFINE FIELD OVERWRITE reason ON vetoed_by TYPE string;
DEFINE FIELD OVERWRITE vetoed_at ON vetoed_by TYPE datetime;

-- Event: fire on transition TO pending_auth
DEFINE EVENT OVERWRITE intent_pending_auth ON intent
  ASYNC
  RETRY 3
  WHEN $before.status != "pending_auth" AND $after.status = "pending_auth"
  THEN {
    http::post(
      "http://127.0.0.1:{PORT}/api/intents/" + <string> meta::id($after.id) + "/evaluate",
      $after,
      { "Content-Type": "application/json" }
    );
  };

-- Extend authority_scope action enum to include intent actions
DEFINE FIELD OVERWRITE action ON authority_scope TYPE string
  ASSERT $value IN [
    "create_decision", "confirm_decision",
    "create_task", "complete_task",
    "create_observation", "acknowledge_observation", "resolve_observation",
    "create_question", "create_suggestion",
    "create_intent", "submit_intent"
  ];

-- Authority scope seeds for intent lifecycle

BEGIN TRANSACTION;

CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "submit_intent", permission: "auto", created_at: time::now() };

CREATE authority_scope CONTENT { agent_type: "architect", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "submit_intent", permission: "auto", created_at: time::now() };

CREATE authority_scope CONTENT { agent_type: "management", action: "create_intent", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "submit_intent", permission: "auto", created_at: time::now() };

COMMIT TRANSACTION;
