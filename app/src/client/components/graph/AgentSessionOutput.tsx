/**
 * AgentSessionOutput -- renders accumulated agent output as streaming text
 * with inline file change notifications.
 *
 * Pure presentational component. All state managed by useAgentSession hook.
 * Auto-scrolls to latest content while streaming is active.
 */

import { useEffect, useRef } from "react";
import type { OutputEntry } from "../../hooks/use-agent-session";
import { isTerminalStatus, type AgentSessionStatus } from "../../hooks/use-agent-session";

// ---------------------------------------------------------------------------
// Pure core: derive display text from output entries
// ---------------------------------------------------------------------------

export function renderTokenText(entries: OutputEntry[]): string {
  return entries
    .filter((e): e is Extract<OutputEntry, { kind: "token" }> => e.kind === "token")
    .map((e) => e.text)
    .join("");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentSessionOutput({
  outputEntries,
  status,
}: {
  outputEntries: OutputEntry[];
  status: AgentSessionStatus;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isStreaming = !isTerminalStatus(status) && status !== "idle";

  // Auto-scroll to bottom when new entries arrive during active streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [outputEntries.length, isStreaming]);

  if (outputEntries.length === 0) {
    return (
      <div
        className="agent-session-output agent-session-output--empty"
        data-testid="agent-session-output"
      >
        <p className="agent-session-output__placeholder">
          Waiting for agent output...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="agent-session-output"
      data-testid="agent-session-output"
    >
      {outputEntries.map((entry, index) => {
        switch (entry.kind) {
          case "token":
            return (
              <span
                key={index}
                className="agent-session-output__token"
                data-testid="agent-output-token"
              >
                {entry.text}
              </span>
            );
          case "file_change":
            return (
              <div
                key={index}
                className="agent-session-output__file-change"
                data-testid="agent-output-file-change"
              >
                <span className="agent-session-output__file-icon">
                  {entry.changeType === "created"
                    ? "+"
                    : entry.changeType === "deleted"
                      ? "-"
                      : "~"}
                </span>
                <span className="agent-session-output__file-path">
                  {entry.file}
                </span>
              </div>
            );
          case "prompt":
            return (
              <div
                key={index}
                className="agent-session-output__prompt"
                data-testid="agent-output-prompt"
              >
                {entry.text}
              </div>
            );
        }
      })}
    </div>
  );
}
