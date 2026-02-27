import type { ReagraphNode, ReagraphEdge, GraphResponse, EntityKind } from "../../shared/contracts";
import type { GraphViewRawResult } from "./queries";

export function entityColor(kind: EntityKind): string {
  switch (kind) {
    case "project": return "var(--entity-project)";
    case "feature": return "var(--entity-feature)";
    case "task": return "var(--entity-task)";
    case "decision": return "var(--entity-decision)";
    case "question": return "var(--entity-question)";
    case "person": return "var(--entity-person)";
    case "workspace": return "var(--entity-project)";
  }
}

function titleCase(s: string): string {
  return s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function transformToReagraph(raw: GraphViewRawResult): GraphResponse {
  const connectionCounts = new Map<string, number>();
  for (const edge of raw.edges) {
    connectionCounts.set(edge.fromId, (connectionCounts.get(edge.fromId) ?? 0) + 1);
    connectionCounts.set(edge.toId, (connectionCounts.get(edge.toId) ?? 0) + 1);
  }

  const nodes: ReagraphNode[] = raw.entities.map((entity) => {
    const kind = entity.kind as EntityKind;
    return {
      id: entity.id,
      label: entity.name.length > 32 ? entity.name.slice(0, 32) + "\u2026" : entity.name,
      fill: entityColor(kind),
      data: {
        kind,
        connectionCount: connectionCounts.get(entity.id) ?? 0,
        status: undefined,
      },
    };
  });

  const edges: ReagraphEdge[] = raw.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromId,
    target: edge.toId,
    label: titleCase(edge.kind.replace(/_/g, " ")),
    data: {
      type: edge.kind,
      confidence: edge.confidence,
    },
  }));

  return { nodes, edges };
}
