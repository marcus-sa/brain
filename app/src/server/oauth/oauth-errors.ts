/**
 * Shared OAuth error response builder.
 *
 * RFC 6749 Section 5.2 error response format used by token endpoint,
 * bridge exchange, and other OAuth handlers.
 */
import { jsonResponse } from "../http/response";

export function oauthErrorResponse(
  error: string,
  errorDescription: string,
  status: number,
): Response {
  return jsonResponse({ error, error_description: errorDescription }, status);
}
