import { getRequestLogger, serializeError } from "../logging";

export function logDebug(event: string, message: string, meta?: Record<string, unknown>): void {
  getRequestLogger().debug(
    {
      event,
      ...(meta ?? {}),
    },
    message,
  );
}

export function logInfo(event: string, message: string, meta?: Record<string, unknown>): void {
  getRequestLogger().info(
    {
      event,
      ...(meta ?? {}),
    },
    message,
  );
}

export function logWarn(event: string, message: string, meta?: Record<string, unknown>): void {
  getRequestLogger().warn(
    {
      event,
      ...(meta ?? {}),
    },
    message,
  );
}

export function logError(event: string, message: string, error: unknown, meta?: Record<string, unknown>): void {
  getRequestLogger().error(
    {
      event,
      ...(meta ?? {}),
      err: serializeError(error),
    },
    message,
  );
}

export function elapsedMs(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(2));
}

export function userFacingError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const causeMessage = extractCauseMessage(error);
  if (causeMessage && causeMessage !== error.message) {
    return `${error.message}: ${causeMessage}`;
  }

  return error.message;
}

function extractCauseMessage(error: Error & { cause?: unknown }): string | undefined {
  const cause = error.cause;
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return cause.message;
  }

  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return undefined;
}
