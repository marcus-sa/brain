/**
 * MCP DPoP + RAR Authentication & Authorization
 *
 * Replaces the legacy authenticateMcpRequest + requireScope pattern.
 * Uniform pipeline for all actor types (human and agent):
 *   1. authenticateDPoPRequest -- verify DPoP token + proof
 *   2. deriveRequestedAction  -- map HTTP method + path to BrainAction
 *   3. verifyOperationScope   -- check token's authorization_details
 *
 * Pure function module -- no IO imports beyond downstream ports.
 *
 * Step-ID: 03-04
 */
import { jsonResponse } from "../http/response";
import { authenticateDPoPRequest, type DPoPVerificationDeps } from "../oauth/dpop-middleware";
import { deriveRequestedAction } from "../oauth/route-action-map";
import { verifyOperationScope } from "../oauth/rar-verifier";
import type { DPoPAuthResult } from "../oauth/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** DPoP authenticator port -- injectable for testing. */
export type DPoPAuthenticator = (
  request: Request,
  deps: DPoPVerificationDeps,
) => Promise<DPoPAuthResult | Response>;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Authenticate and authorize an MCP request via DPoP + RAR.
 *
 * Returns DPoPAuthResult on success, or an error Response.
 * Accepts an optional authenticator parameter for test injection.
 */
export async function authenticateAndAuthorize(
  request: Request,
  dpopDeps: DPoPVerificationDeps,
  authenticator: DPoPAuthenticator = authenticateDPoPRequest,
): Promise<DPoPAuthResult | Response> {
  // Step 1: DPoP token + proof verification
  const authResult = await authenticator(request, dpopDeps);
  if (authResult instanceof Response) {
    return authResult;
  }

  // Step 2: Derive BrainAction from HTTP method + URL path
  const url = new URL(request.url);
  const requestedAction = deriveRequestedAction(request.method, url.pathname);

  if (!requestedAction) {
    return jsonResponse(
      { error: "unmapped_route", error_description: "No action mapping for this route" },
      403,
    );
  }

  // Step 3: Verify operation scope against token's authorization_details
  const verification = verifyOperationScope(requestedAction, authResult.authorizationDetails);

  if (!verification.authorized) {
    return jsonResponse(
      { error: verification.code, error_description: verification.error },
      403,
    );
  }

  return authResult;
}
