import { componentCatalog } from "reachat";
import type { ExtractableKind } from "../shared/chat-component-definitions";
import {
  chatComponentDefinitions,
  type EntityCardProps,
  type ExtractionSummaryProps,
} from "../shared/chat-component-definitions";

const kindLabelByKind: Record<ExtractableKind, string> = {
  project: "Project",
  person: "Person",
  feature: "Feature",
  task: "Task",
  decision: "Decision",
  question: "Question",
};

function EntityCard(props: EntityCardProps) {
  return (
    <article className="entity-card">
      <div className="entity-card-header">
        <span className="entity-kind">{kindLabelByKind[props.kind]}</span>
        <span className="entity-status">{props.status}</span>
      </div>
      <p className="entity-name">{props.name}</p>
      <p className="entity-confidence">Confidence {props.confidence.toFixed(2)}</p>
    </article>
  );
}

function ExtractionSummary(props: ExtractionSummaryProps) {
  return (
    <section className="extraction-summary">
      <p className="extraction-summary-title">{props.title}</p>
      <div className="extraction-summary-grid">
        {props.entities.map((entity) => (
          <EntityCard
            key={`${entity.kind}:${entity.name.toLowerCase()}`}
            kind={entity.kind}
            name={entity.name}
            confidence={entity.confidence}
            status={entity.status}
          />
        ))}
      </div>
      <p className="extraction-summary-meta">{props.relationshipCount} high-confidence relationships detected</p>
    </section>
  );
}

export const chatComponentCatalog = componentCatalog({
  EntityCard: {
    ...chatComponentDefinitions.EntityCard,
    component: EntityCard as any,
  },
  ExtractionSummary: {
    ...chatComponentDefinitions.ExtractionSummary,
    component: ExtractionSummary as any,
  },
});
