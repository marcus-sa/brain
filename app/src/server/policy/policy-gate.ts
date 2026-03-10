import type { RecordId, Surreal } from "surrealdb";
import type {
  PolicyRecord,
  PolicyRule,
  PolicyGateResult,
  PolicyTraceEntry,
  PolicyGateWarning,
  IntentEvaluationContext,
} from "./types";
import { evaluateCondition } from "./predicate-evaluator";
import { loadActivePolicies } from "./policy-queries";

// ---------------------------------------------------------------------------
// Pipeline Types
// ---------------------------------------------------------------------------

type AnnotatedRule = {
  policyId: string;
  policyVersion: number;
  humanVetoRequired: boolean;
  rule: PolicyRule;
};

type EvaluatedRule = AnnotatedRule & {
  matched: boolean;
  warnings: PolicyGateWarning[];
};

type EvaluationResult = {
  evaluatedRules: EvaluatedRule[];
  denyMatched: boolean;
  warnings: PolicyGateWarning[];
};

// ---------------------------------------------------------------------------
// Pure Pipeline Functions
// ---------------------------------------------------------------------------

export const deduplicatePolicies = (
  policies: PolicyRecord[],
): PolicyRecord[] => {
  const seen = new Set<string>();
  const result: PolicyRecord[] = [];

  for (const policy of policies) {
    const id = policy.id.id as string;
    if (!seen.has(id)) {
      seen.add(id);
      result.push(policy);
    }
  }

  return result;
};

export const collectAndSortRules = (
  policies: PolicyRecord[],
): AnnotatedRule[] => {
  const annotated = policies.flatMap((policy) =>
    policy.rules.map((rule) => ({
      policyId: policy.id.id as string,
      policyVersion: policy.version,
      humanVetoRequired: policy.human_veto_required,
      rule,
    })),
  );

  return annotated.sort((a, b) => b.rule.priority - a.rule.priority);
};

export const evaluateRulesAgainstContext = (
  rules: AnnotatedRule[],
  context: IntentEvaluationContext,
): EvaluationResult => {
  const contextRecord = context as unknown as Record<string, unknown>;
  const evaluatedRules: EvaluatedRule[] = [];
  const allWarnings: PolicyGateWarning[] = [];

  for (const annotated of rules) {
    const { matched, warnings } = evaluateCondition(
      contextRecord,
      annotated.rule.condition,
      annotated.rule.id,
      annotated.policyId,
    );

    allWarnings.push(...warnings);
    evaluatedRules.push({ ...annotated, matched, warnings });

    if (matched && annotated.rule.effect === "deny") {
      return {
        evaluatedRules,
        denyMatched: true,
        warnings: allWarnings,
      };
    }
  }

  return {
    evaluatedRules,
    denyMatched: false,
    warnings: allWarnings,
  };
};

export const buildGateResult = (
  evaluatedRules: EvaluatedRule[],
  denyMatched: boolean,
  warnings: PolicyGateWarning[],
): PolicyGateResult => {
  const policyTrace: PolicyTraceEntry[] = evaluatedRules.map((entry) => ({
    policy_id: entry.policyId,
    policy_version: entry.policyVersion,
    rule_id: entry.rule.id,
    effect: entry.rule.effect,
    matched: entry.matched,
    priority: entry.rule.priority,
  }));

  if (denyMatched) {
    const denyRule = evaluatedRules.find(
      (entry) => entry.matched && entry.rule.effect === "deny",
    );
    return {
      passed: false,
      reason: `Policy deny rule '${denyRule!.rule.id}' matched`,
      policy_trace: policyTrace,
      deny_rule_id: denyRule!.rule.id,
      warnings,
    };
  }

  const humanVetoRequired = evaluatedRules.some(
    (entry) => entry.humanVetoRequired,
  );

  return {
    passed: true,
    policy_trace: policyTrace,
    human_veto_required: humanVetoRequired,
    warnings,
  };
};

// ---------------------------------------------------------------------------
// Composition Root (single effect boundary)
// ---------------------------------------------------------------------------

export const evaluatePolicyGate = async (
  surreal: Surreal,
  identityId: RecordId<"identity">,
  workspaceId: RecordId<"workspace">,
  intentContext: IntentEvaluationContext,
): Promise<PolicyGateResult> => {
  // Effect boundary: single DB read
  const rawPolicies = await loadActivePolicies(surreal, identityId, workspaceId);

  // Pure pipeline
  const deduplicated = deduplicatePolicies(rawPolicies);
  const sortedRules = collectAndSortRules(deduplicated);
  const { evaluatedRules, denyMatched, warnings } = evaluateRulesAgainstContext(
    sortedRules,
    intentContext,
  );

  return buildGateResult(evaluatedRules, denyMatched, warnings);
};
