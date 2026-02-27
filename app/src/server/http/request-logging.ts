import { randomUUID } from "node:crypto";
import { runWithRequestContext } from "../request-context";
import { jsonError, withRequestIdHeader } from "./response";
import { elapsedMs, logDebug, logError, logInfo } from "./observability";

export type RouteRequest = Request & {
  params: Record<string, string>;
};

export type RouteHandler = (request: RouteRequest) => Response | Promise<Response>;

export function withRequestLogging(route: string, method: string, handler: RouteHandler): RouteHandler {
  return async (request: RouteRequest) => {
    const startedAt = performance.now();
    const headerValue = request.headers.get("x-request-id")?.trim();
    const requestId = headerValue && headerValue.length > 0 ? headerValue : randomUUID();
    const path = new URL(request.url).pathname;

    return runWithRequestContext(
      {
        requestId,
        method,
        route,
        path,
      },
      async () => {
        logDebug("http.request.received", "HTTP request received");

        try {
          const response = await handler(request);
          const responseWithRequestId = withRequestIdHeader(response, requestId);
          logInfo("http.request.completed", "HTTP request completed", {
            statusCode: responseWithRequestId.status,
            durationMs: elapsedMs(startedAt),
          });
          return responseWithRequestId;
        } catch (error) {
          logError("http.request.failed", "HTTP request failed", error, {
            durationMs: elapsedMs(startedAt),
          });
          const fallback = jsonError("internal server error", 500);
          return withRequestIdHeader(fallback, requestId);
        }
      },
    );
  };
}
