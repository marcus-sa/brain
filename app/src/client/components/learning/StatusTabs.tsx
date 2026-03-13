import type { LearningStatus, LearningSummary } from "../../../shared/contracts";

export type StatusTabDefinition = {
  status: LearningStatus;
  label: string;
};

/** The four status tabs displayed in the learning library. */
export const STATUS_TAB_DEFINITIONS: readonly StatusTabDefinition[] = [
  { status: "active", label: "Active" },
  { status: "pending_approval", label: "Pending" },
  { status: "dismissed", label: "Dismissed" },
  { status: "deactivated", label: "Deactivated" },
] as const;

export type StatusCounts = Record<
  "active" | "pending_approval" | "dismissed" | "deactivated",
  number
>;

/** Pure function: compute per-status counts from a list of learnings. */
export function computeStatusCounts(learnings: LearningSummary[]): StatusCounts {
  const counts: StatusCounts = {
    active: 0,
    pending_approval: 0,
    dismissed: 0,
    deactivated: 0,
  };

  for (const learning of learnings) {
    if (learning.status in counts) {
      counts[learning.status as keyof StatusCounts]++;
    }
  }

  return counts;
}

type StatusTabsProps = {
  activeStatus: LearningStatus;
  counts: StatusCounts;
  onStatusChange: (status: LearningStatus) => void;
};

export function StatusTabs({ activeStatus, counts, onStatusChange }: StatusTabsProps) {
  return (
    <div className="status-tabs">
      {STATUS_TAB_DEFINITIONS.map((tab) => (
        <button
          key={tab.status}
          className={`status-tabs__tab${activeStatus === tab.status ? " status-tabs__tab--active" : ""}`}
          onClick={() => onStatusChange(tab.status)}
          aria-selected={activeStatus === tab.status}
          role="tab"
        >
          {tab.label}
          <span className="status-tabs__count">{counts[tab.status as keyof StatusCounts]}</span>
        </button>
      ))}
    </div>
  );
}
