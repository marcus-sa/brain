BEGIN TRANSACTION;

-- Evolve person table for better-auth
DEFINE FIELD OVERWRITE contact_email ON person TYPE string;
DEFINE FIELD OVERWRITE email_verified ON person TYPE bool DEFAULT false;
DEFINE FIELD OVERWRITE image ON person TYPE option<string>;
DEFINE FIELD OVERWRITE updated_at ON person TYPE datetime;
DEFINE INDEX OVERWRITE person_email ON person FIELDS contact_email UNIQUE;

-- Session
DEFINE TABLE OVERWRITE session SCHEMAFULL;
DEFINE FIELD person_id ON session TYPE record<person>;
DEFINE FIELD token ON session TYPE string;
DEFINE FIELD expires_at ON session TYPE datetime;
DEFINE FIELD ip_address ON session TYPE option<string>;
DEFINE FIELD user_agent ON session TYPE option<string>;
DEFINE FIELD created_at ON session TYPE datetime;
DEFINE FIELD updated_at ON session TYPE datetime;
DEFINE INDEX session_token ON session FIELDS token UNIQUE;
DEFINE INDEX session_person_id ON session FIELDS person_id;

-- Account (OAuth provider links)
DEFINE TABLE OVERWRITE account SCHEMAFULL;
DEFINE FIELD person_id ON account TYPE record<person>;
DEFINE FIELD account_id ON account TYPE string;
DEFINE FIELD provider_id ON account TYPE string;
DEFINE FIELD access_token ON account TYPE option<string>;
DEFINE FIELD refresh_token ON account TYPE option<string>;
DEFINE FIELD access_token_expires_at ON account TYPE option<datetime>;
DEFINE FIELD refresh_token_expires_at ON account TYPE option<datetime>;
DEFINE FIELD scope ON account TYPE option<string>;
DEFINE FIELD id_token ON account TYPE option<string>;
DEFINE FIELD password ON account TYPE option<string>;
DEFINE FIELD created_at ON account TYPE datetime;
DEFINE FIELD updated_at ON account TYPE datetime;
DEFINE INDEX account_person_id ON account FIELDS person_id;
DEFINE INDEX account_provider ON account FIELDS provider_id, account_id;

-- Verification
DEFINE TABLE OVERWRITE verification SCHEMAFULL;
DEFINE FIELD identifier ON verification TYPE string;
DEFINE FIELD value ON verification TYPE string;
DEFINE FIELD expires_at ON verification TYPE datetime;
DEFINE FIELD created_at ON verification TYPE datetime;
DEFINE FIELD updated_at ON verification TYPE datetime;
DEFINE INDEX verification_identifier ON verification FIELDS identifier;

COMMIT TRANSACTION;
