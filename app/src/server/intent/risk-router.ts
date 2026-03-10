import type { EvaluationResult, RoutingDecision } from "./types";

const DEFAULT_AUTO_APPROVE_THRESHOLD = 30;
const DEFAULT_VETO_WINDOW_MINUTES = 30;

type RiskRouterOptions = {
  threshold?: number;
  vetoWindowMinutes?: number;
  human_veto_required?: boolean;
};

export function routeByRisk(
  evaluation: EvaluationResult,
  options?: RiskRouterOptions,
): RoutingDecision {
  if (evaluation.decision === "REJECT") {
    return { route: "reject", reason: evaluation.reason };
  }

  const threshold = options?.threshold ?? DEFAULT_AUTO_APPROVE_THRESHOLD;
  const vetoMinutes = options?.vetoWindowMinutes ?? DEFAULT_VETO_WINDOW_MINUTES;

  // Policy human_veto_required forces veto_window regardless of risk score
  if (options?.human_veto_required) {
    const expiresAt = new Date(Date.now() + vetoMinutes * 60 * 1000);
    return { route: "veto_window", expires_at: expiresAt };
  }

  if (evaluation.risk_score <= threshold) {
    return { route: "auto_approve" };
  }

  const expiresAt = new Date(Date.now() + vetoMinutes * 60 * 1000);

  return { route: "veto_window", expires_at: expiresAt };
}
