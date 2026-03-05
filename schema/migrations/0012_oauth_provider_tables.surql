-- Remove API key field from workspace (clean cut to OAuth)
-- REMOVE FIELD cannot run inside a transaction in SurrealDB v3.0
REMOVE FIELD IF EXISTS api_key_hash ON workspace;

BEGIN TRANSACTION;

-- OAuth Client (registered agents / CLI tools)
DEFINE TABLE oauthClient SCHEMAFULL;
DEFINE FIELD clientId ON oauthClient TYPE string;
DEFINE FIELD clientSecret ON oauthClient TYPE option<string>;
DEFINE FIELD disabled ON oauthClient TYPE option<bool> DEFAULT false;
DEFINE FIELD skipConsent ON oauthClient TYPE option<bool>;
DEFINE FIELD enableEndSession ON oauthClient TYPE option<bool>;
DEFINE FIELD scopes ON oauthClient TYPE option<string>;
DEFINE FIELD userId ON oauthClient TYPE option<record<person>>;
DEFINE FIELD referenceId ON oauthClient TYPE option<string>;
DEFINE FIELD createdAt ON oauthClient TYPE option<datetime>;
DEFINE FIELD updatedAt ON oauthClient TYPE option<datetime>;
DEFINE FIELD expiresAt ON oauthClient TYPE option<datetime>;
DEFINE FIELD name ON oauthClient TYPE option<string>;
DEFINE FIELD uri ON oauthClient TYPE option<string>;
DEFINE FIELD icon ON oauthClient TYPE option<string>;
DEFINE FIELD contacts ON oauthClient TYPE option<string>;
DEFINE FIELD tos ON oauthClient TYPE option<string>;
DEFINE FIELD policy ON oauthClient TYPE option<string>;
DEFINE FIELD softwareId ON oauthClient TYPE option<string>;
DEFINE FIELD softwareVersion ON oauthClient TYPE option<string>;
DEFINE FIELD softwareStatement ON oauthClient TYPE option<string>;
DEFINE FIELD redirectUris ON oauthClient TYPE string;
DEFINE FIELD postLogoutRedirectUris ON oauthClient TYPE option<string>;
DEFINE FIELD tokenEndpointAuthMethod ON oauthClient TYPE option<string>;
DEFINE FIELD grantTypes ON oauthClient TYPE option<string>;
DEFINE FIELD responseTypes ON oauthClient TYPE option<string>;
DEFINE FIELD public ON oauthClient TYPE option<bool>;
DEFINE FIELD requirePKCE ON oauthClient TYPE option<bool>;
DEFINE FIELD metadata ON oauthClient TYPE option<string>;
DEFINE INDEX oauthClient_clientId ON oauthClient FIELDS clientId UNIQUE;
DEFINE INDEX oauthClient_userId ON oauthClient FIELDS userId;

-- OAuth Access Token (for revocation tracking and introspection)
DEFINE TABLE oauthAccessToken SCHEMAFULL;
DEFINE FIELD token ON oauthAccessToken TYPE string;
DEFINE FIELD clientId ON oauthAccessToken TYPE string;
DEFINE FIELD sessionId ON oauthAccessToken TYPE option<record<session>>;
DEFINE FIELD userId ON oauthAccessToken TYPE option<record<person>>;
DEFINE FIELD referenceId ON oauthAccessToken TYPE option<string>;
DEFINE FIELD refreshId ON oauthAccessToken TYPE option<record<oauthRefreshToken>>;
DEFINE FIELD scopes ON oauthAccessToken TYPE string;
DEFINE FIELD expiresAt ON oauthAccessToken TYPE datetime;
DEFINE FIELD createdAt ON oauthAccessToken TYPE datetime;
DEFINE INDEX oauthAccessToken_token ON oauthAccessToken FIELDS token UNIQUE;
DEFINE INDEX oauthAccessToken_clientId ON oauthAccessToken FIELDS clientId;

-- OAuth Refresh Token
DEFINE TABLE oauthRefreshToken SCHEMAFULL;
DEFINE FIELD token ON oauthRefreshToken TYPE string;
DEFINE FIELD clientId ON oauthRefreshToken TYPE string;
DEFINE FIELD sessionId ON oauthRefreshToken TYPE option<record<session>>;
DEFINE FIELD userId ON oauthRefreshToken TYPE option<record<person>>;
DEFINE FIELD referenceId ON oauthRefreshToken TYPE option<string>;
DEFINE FIELD scopes ON oauthRefreshToken TYPE string;
DEFINE FIELD revoked ON oauthRefreshToken TYPE option<datetime>;
DEFINE FIELD authTime ON oauthRefreshToken TYPE option<datetime>;
DEFINE FIELD createdAt ON oauthRefreshToken TYPE datetime;
DEFINE FIELD expiresAt ON oauthRefreshToken TYPE datetime;
DEFINE INDEX oauthRefreshToken_token ON oauthRefreshToken FIELDS token UNIQUE;
DEFINE INDEX oauthRefreshToken_clientId ON oauthRefreshToken FIELDS clientId;

-- OAuth Consent (user approvals per client/scope)
DEFINE TABLE oauthConsent SCHEMAFULL;
DEFINE FIELD clientId ON oauthConsent TYPE string;
DEFINE FIELD userId ON oauthConsent TYPE option<record<person>>;
DEFINE FIELD referenceId ON oauthConsent TYPE option<string>;
DEFINE FIELD scopes ON oauthConsent TYPE string;
DEFINE FIELD createdAt ON oauthConsent TYPE datetime;
DEFINE FIELD updatedAt ON oauthConsent TYPE datetime;
DEFINE INDEX oauthConsent_clientId_userId ON oauthConsent FIELDS clientId, userId;

-- JWKS (JWT signing keys)
DEFINE TABLE jwks SCHEMAFULL;
DEFINE FIELD publicKey ON jwks TYPE string;
DEFINE FIELD privateKey ON jwks TYPE string;
DEFINE FIELD createdAt ON jwks TYPE datetime;
DEFINE FIELD expiresAt ON jwks TYPE option<datetime>;

COMMIT TRANSACTION;
