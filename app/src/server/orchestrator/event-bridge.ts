/**
 * Event bridge: transforms Claude Agent SDK messages into Brain StreamEvent
 * variants and forwards them to the SSE registry.
 *
 * Pure transform function (transformSdkMessage) + effectful bridge handle
 * (startEventBridge) that manages the event forwarding lifecycle.
 */
import type {
  AgentTokenEvent,
  AgentFileChangeEvent,
  AgentStatusEvent,
  StreamEvent,
} from "../../shared/contracts";
import type { StallDetectorHandle } from "./stall-detector";

// ---------------------------------------------------------------------------
// SDK message types (from @anthropic-ai/claude-code)
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type SdkMessage =
  | { type: "assistant"; content: ContentBlock[] }
  | { type: "result"; subtype: "success"; duration_ms: number }
  | { type: "result"; subtype: "error"; error: string }
  | { type: "user" };

// ---------------------------------------------------------------------------
// Backward-compatible aliases (consumed by session-lifecycle until migrated)
// ---------------------------------------------------------------------------

/** @deprecated Use SdkMessage instead. */
export type OpencodeEvent =
  | { type: "message.part.updated"; sessionId: string; part: { type: "text"; content: string } }
  | { type: "file.edited"; sessionId: string; file: string }
  | { type: "session.updated"; sessionId: string; status: string }
  | { type: "session.error"; sessionId: string; error: string };

// ---------------------------------------------------------------------------
// Port: dependencies as function signatures
// ---------------------------------------------------------------------------

export type EventBridgeDeps = {
  emitEvent: (streamId: string, event: StreamEvent) => void;
  updateLastEventAt: (sessionId: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Bridge handle
// ---------------------------------------------------------------------------

export type EventBridgeHandle = {
  handleMessage: (message: SdkMessage) => void;
  /** @deprecated Use handleMessage instead. Accepts legacy OpencodeEvent. */
  handleEvent: (event: OpencodeEvent) => void;
  stop: () => void;
};

// ---------------------------------------------------------------------------
// File operation tool detection
// ---------------------------------------------------------------------------

/** Tool names that represent file write/edit operations. */
const FILE_WRITE_TOOLS = new Set(["Write"]);
const FILE_EDIT_TOOLS = new Set(["Edit"]);

function isFileOperationTool(toolName: string): boolean {
  return FILE_WRITE_TOOLS.has(toolName) || FILE_EDIT_TOOLS.has(toolName);
}

function extractFileChangeType(toolName: string): AgentFileChangeEvent["changeType"] {
  if (FILE_WRITE_TOOLS.has(toolName)) return "created";
  if (FILE_EDIT_TOOLS.has(toolName)) return "modified";
  return "modified";
}

function extractFilePath(input: Record<string, unknown>): string | undefined {
  if (typeof input.file_path === "string") return input.file_path;
  return undefined;
}

// ---------------------------------------------------------------------------
// Pure transform: SDK message -> Brain StreamEvent[]
// ---------------------------------------------------------------------------

function transformTextBlock(
  block: { type: "text"; text: string },
  sessionId: string,
): AgentTokenEvent {
  return {
    type: "agent_token",
    sessionId,
    token: block.text,
  };
}

function transformToolUseBlock(
  block: { type: "tool_use"; id: string; name: string; input: Record<string, unknown> },
  sessionId: string,
): AgentFileChangeEvent | undefined {
  if (!isFileOperationTool(block.name)) return undefined;

  const filePath = extractFilePath(block.input);
  if (!filePath) return undefined;

  return {
    type: "agent_file_change",
    sessionId,
    file: filePath,
    changeType: extractFileChangeType(block.name),
  };
}

function transformAssistantContent(
  content: ContentBlock[],
  sessionId: string,
): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const block of content) {
    if (block.type === "text") {
      events.push(transformTextBlock(block, sessionId));
    } else if (block.type === "tool_use") {
      const fileEvent = transformToolUseBlock(block, sessionId);
      if (fileEvent) events.push(fileEvent);
    }
  }
  return events;
}

function transformResultMessage(
  message: { type: "result"; subtype: "success"; duration_ms: number } | { type: "result"; subtype: "error"; error: string },
  sessionId: string,
): AgentStatusEvent {
  if (message.subtype === "error") {
    return {
      type: "agent_status",
      sessionId,
      status: "error",
      error: message.error,
    };
  }
  return {
    type: "agent_status",
    sessionId,
    status: "completed",
  };
}

export function transformSdkMessage(
  message: SdkMessage,
  sessionId: string,
): StreamEvent[] {
  switch (message.type) {
    case "assistant":
      return transformAssistantContent(message.content, sessionId);

    case "result":
      return [transformResultMessage(message, sessionId)];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Legacy transform (backward compat)
// ---------------------------------------------------------------------------

const LEGACY_STATUS_MAP: Record<string, AgentStatusEvent["status"]> = {
  busy: "active",
  running: "active",
  idle: "idle",
  completed: "completed",
  done: "completed",
  error: "error",
  failed: "error",
  aborted: "aborted",
  cancelled: "aborted",
};

/** @deprecated Use transformSdkMessage instead. */
export function transformOpencodeEvent(
  event: OpencodeEvent,
): AgentTokenEvent | AgentFileChangeEvent | AgentStatusEvent {
  switch (event.type) {
    case "message.part.updated":
      return {
        type: "agent_token",
        sessionId: event.sessionId,
        token: event.part.content,
      };
    case "file.edited":
      return {
        type: "agent_file_change",
        sessionId: event.sessionId,
        file: event.file,
        changeType: "modified",
      };
    case "session.updated":
      return {
        type: "agent_status",
        sessionId: event.sessionId,
        status: LEGACY_STATUS_MAP[event.status] ?? "active",
      };
    case "session.error":
      return {
        type: "agent_status",
        sessionId: event.sessionId,
        status: "error",
        error: event.error,
      };
  }
}

// ---------------------------------------------------------------------------
// Step event detection for stall detector
// ---------------------------------------------------------------------------

/** Returns true if the message contains tool_use blocks for file operations. */
function containsFileOperationStep(message: SdkMessage): boolean {
  if (message.type !== "assistant") return false;
  return message.content.some(
    (block) => block.type === "tool_use" && isFileOperationTool(block.name),
  );

}

// ---------------------------------------------------------------------------
// Bridge handle factory
// ---------------------------------------------------------------------------

export function startEventBridge(
  deps: EventBridgeDeps,
  streamId: string,
  sessionId: string,
  stallDetector?: StallDetectorHandle,
): EventBridgeHandle {
  let stopped = false;

  const handleMessage = (message: SdkMessage): void => {
    if (stopped) return;

    const streamEvents = transformSdkMessage(message, sessionId);
    for (const streamEvent of streamEvents) {
      deps.emitEvent(streamId, streamEvent);
    }

    // Fire-and-forget: update last_event_at for stall detection
    if (streamEvents.length > 0) {
      deps.updateLastEventAt(sessionId);
    }

    // Notify stall detector of activity
    if (stallDetector && streamEvents.length > 0) {
      stallDetector.recordActivity();

      if (containsFileOperationStep(message)) {
        stallDetector.incrementStepCount();
      }
    }
  };

  /** @deprecated Use handleMessage instead. */
  const handleEvent = (event: OpencodeEvent): void => {
    if (stopped) return;

    const streamEvent = transformOpencodeEvent(event);
    deps.emitEvent(streamId, streamEvent);

    deps.updateLastEventAt(sessionId);

    if (stallDetector) {
      stallDetector.recordActivity();

      if (event.type === "file.edited") {
        stallDetector.incrementStepCount();
      }
    }
  };

  return {
    handleMessage,
    handleEvent,
    stop(): void {
      stopped = true;
      stallDetector?.stop();
    },
  };
}
