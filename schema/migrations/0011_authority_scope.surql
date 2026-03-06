BEGIN TRANSACTION;

DEFINE TABLE IF NOT EXISTS authority_scope SCHEMAFULL;
DEFINE FIELD OVERWRITE agent_type ON authority_scope TYPE string
  ASSERT $value IN ["code_agent", "architect", "management", "design_partner", "observer"];
DEFINE FIELD OVERWRITE action ON authority_scope TYPE string
  ASSERT $value IN [
    "create_decision", "confirm_decision",
    "create_task", "complete_task",
    "create_observation", "acknowledge_observation", "resolve_observation",
    "create_question", "create_suggestion"
  ];
DEFINE FIELD OVERWRITE permission ON authority_scope TYPE string
  ASSERT $value IN ["auto", "provisional", "propose", "blocked"];
DEFINE FIELD OVERWRITE workspace ON authority_scope TYPE option<record<workspace>>;
DEFINE FIELD OVERWRITE created_at ON authority_scope TYPE datetime;
DEFINE INDEX IF NOT EXISTS authority_scope_lookup ON authority_scope
  FIELDS agent_type, action, workspace UNIQUE;

-- Seed: code_agent
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_decision", permission: "provisional", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "confirm_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_task", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "complete_task", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "acknowledge_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "resolve_observation", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_question", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "code_agent", action: "create_suggestion", permission: "auto", created_at: time::now() };

-- Seed: architect
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_decision", permission: "provisional", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "confirm_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_task", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "complete_task", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "acknowledge_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "resolve_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_question", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "architect", action: "create_suggestion", permission: "auto", created_at: time::now() };

-- Seed: management
CREATE authority_scope CONTENT { agent_type: "management", action: "create_decision", permission: "provisional", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "confirm_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "create_task", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "complete_task", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "create_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "acknowledge_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "resolve_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "create_question", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "management", action: "create_suggestion", permission: "auto", created_at: time::now() };

-- Seed: design_partner
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "create_decision", permission: "provisional", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "confirm_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "create_task", permission: "provisional", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "complete_task", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "create_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "acknowledge_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "resolve_observation", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "create_question", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "design_partner", action: "create_suggestion", permission: "auto", created_at: time::now() };

-- Seed: observer
CREATE authority_scope CONTENT { agent_type: "observer", action: "create_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "confirm_decision", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "create_task", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "complete_task", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "create_observation", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "acknowledge_observation", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "resolve_observation", permission: "blocked", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "create_question", permission: "auto", created_at: time::now() };
CREATE authority_scope CONTENT { agent_type: "observer", action: "create_suggestion", permission: "blocked", created_at: time::now() };

COMMIT TRANSACTION;
