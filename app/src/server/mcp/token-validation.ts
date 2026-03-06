import { verifyAccessToken } from "better-auth/oauth2";

export type BrainTokenClaims = {
  sub: string;
  scope?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  "urn:brain:workspace"?: string;
  "urn:brain:workspace_name"?: string;
  "urn:brain:agent_type"?: string;
  [key: string]: unknown;
};

/**
 * Create a JWT validator that verifies access tokens using the auth server's JWKS.
 * Tokens must be JWTs (issued when `resource` param is passed during authorization).
 */
export function createJwtValidator(issuerUrl: string) {
  const jwksUrl = `${issuerUrl}/api/auth/jwks`;
  // better-auth sets iss to baseURL + basePath (e.g. "http://localhost:3000/api/auth")
  const issuer = `${issuerUrl}/api/auth`;

  return async (token: string): Promise<BrainTokenClaims> => {
    const payload = await verifyAccessToken(token, {
      jwksUrl,
      verifyOptions: {
        issuer,
        audience: issuerUrl,
      },
    });
    return payload as BrainTokenClaims;
  };
}
