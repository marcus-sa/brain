import { useCallback } from "react";
import { StatusTabs, computeStatusCounts } from "../components/learning/StatusTabs";
import { useLearnings } from "../hooks/use-learnings";
import type { LearningStatus } from "../../shared/contracts";

export function LearningsPage() {
  const { learnings, isLoading, error, filters, setFilters } = useLearnings();

  const activeStatus: LearningStatus = filters.status ?? "active";
  const counts = computeStatusCounts(learnings);

  const handleStatusChange = useCallback(
    (status: LearningStatus) => {
      setFilters({ ...filters, status });
    },
    [filters, setFilters],
  );

  return (
    <section className="learnings-page">
      <h1>Learnings</h1>
      <StatusTabs
        activeStatus={activeStatus}
        counts={counts}
        onStatusChange={handleStatusChange}
      />
      {isLoading && <p className="learnings-page__loading">Loading learnings...</p>}
      {error && <p className="learnings-page__error">{error}</p>}
    </section>
  );
}
