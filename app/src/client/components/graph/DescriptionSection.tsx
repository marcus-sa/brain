import { useState } from "react";
import type { EntityKind } from "../../../shared/contracts";

type DescriptionEntryData = {
  text: string;
  reasoning: string;
  created_at: string;
};

const DESCRIBABLE_KINDS = new Set<EntityKind>(["project", "feature", "task"]);

export function DescriptionSection({
  data,
  kind,
}: {
  data: Record<string, unknown>;
  kind: EntityKind;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!DESCRIBABLE_KINDS.has(kind)) {
    return undefined;
  }

  const description = data.description as string | undefined;
  const entries = data.description_entries as DescriptionEntryData[] | undefined;

  if (!description && (!entries || entries.length === 0)) {
    return undefined;
  }

  return (
    <div className="entity-detail-section">
      <h4>Description</h4>
      {description ? (
        <p className="entity-detail-description">{description}</p>
      ) : undefined}

      {entries && entries.length > 0 ? (
        <>
          <button
            type="button"
            className="description-timeline-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "\u25BC" : "\u25B6"} History ({entries.length} {entries.length === 1 ? "entry" : "entries"})
          </button>

          {expanded ? (
            <div className="description-timeline">
              {[...entries].reverse().map((entry, index) => (
                <div key={`desc-${index}`} className="description-timeline-entry">
                  <span className="description-timeline-date">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                  <span className="description-timeline-text">{entry.text}</span>
                  <span className="description-timeline-reasoning">{entry.reasoning}</span>
                </div>
              ))}
            </div>
          ) : undefined}
        </>
      ) : undefined}
    </div>
  );
}
