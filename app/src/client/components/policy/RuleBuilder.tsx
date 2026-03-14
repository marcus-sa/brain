/**
 * Inline rule editor for policy creation.
 *
 * Each rule has a condition (field/operator/value), effect (allow/deny), and priority.
 * Pure state transformations are extracted as standalone functions.
 * Field autocomplete is sourced from IntentEvaluationContext shape.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Known fields from IntentEvaluationContext
// ---------------------------------------------------------------------------

export type FieldType = "string" | "number";

export type FieldSuggestion = {
  path: string;
  type: FieldType;
  description: string;
};

export const KNOWN_FIELDS: FieldSuggestion[] = [
  { path: "goal", type: "string", description: "Intent goal statement" },
  { path: "reasoning", type: "string", description: "Intent reasoning" },
  { path: "priority", type: "number", description: "Intent priority level" },
  { path: "action_spec.action", type: "string", description: "Action to perform" },
  { path: "action_spec.provider", type: "string", description: "Service provider" },
  { path: "action_spec.tool", type: "string", description: "Tool identifier" },
  { path: "budget_limit.amount", type: "number", description: "Budget amount limit" },
  { path: "budget_limit.currency", type: "string", description: "Budget currency code" },
  { path: "authorization_details.type", type: "string", description: "Authorization type" },
  { path: "requester_type", type: "string", description: "Type of requester" },
  { path: "requester_role", type: "string", description: "Role of requester" },
];

// ---------------------------------------------------------------------------
// Pure functions: autocomplete filtering
// ---------------------------------------------------------------------------

/** Pure: filter known fields by prefix match on path. */
export function filterFields(query: string, knownFields: FieldSuggestion[]): FieldSuggestion[] {
  if (query.length === 0) return knownFields;
  const lower = query.toLowerCase();
  return knownFields.filter((f) => f.path.toLowerCase().includes(lower));
}

/** Pure: look up the field type for a known field path. */
export function lookupFieldType(fieldPath: string, knownFields: FieldSuggestion[]): FieldType | undefined {
  return knownFields.find((f) => f.path === fieldPath)?.type;
}

// ---------------------------------------------------------------------------
// Pure functions: operator filtering by field type
// ---------------------------------------------------------------------------

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less or equal" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
  { value: "exists", label: "exists" },
] as const;

const STRING_OPERATORS: ReadonlySet<string> = new Set(["eq", "neq", "in", "not_in", "exists"]);
const NUMBER_OPERATORS: ReadonlySet<string> = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "exists"]);

/** Pure: return operators applicable to the given field type. */
export function getOperatorsForType(fieldType?: FieldType) {
  if (fieldType === "string") return OPERATORS.filter((op) => STRING_OPERATORS.has(op.value));
  if (fieldType === "number") return OPERATORS.filter((op) => NUMBER_OPERATORS.has(op.value));
  return [...OPERATORS];
}

// ---------------------------------------------------------------------------
// Pure functions: human-readable rule preview
// ---------------------------------------------------------------------------

const OPERATOR_DISPLAY: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  in: "is in",
  not_in: "is not in",
  exists: "exists",
};

/** Pure: format a rule as a human-readable preview string. */
export function formatRulePreview(field: string, operator: string, value: string, effect: string): string {
  if (!field) return "";
  const effectLabel = effect === "deny" ? "Deny" : "Allow";
  const operatorLabel = OPERATOR_DISPLAY[operator] ?? operator;
  if (operator === "exists") return `${effectLabel} when ${field} ${operatorLabel}`;
  if (!value) return `${effectLabel} when ${field} ${operatorLabel} ...`;
  return `${effectLabel} when ${field} ${operatorLabel} ${value}`;
}

const EFFECTS = [
  { value: "allow", label: "Allow" },
  { value: "deny", label: "Deny" },
] as const;

export type RuleOperator = (typeof OPERATORS)[number]["value"];
export type RuleEffect = "allow" | "deny";

export type RuleEntry = {
  id: string;
  field: string;
  operator: RuleOperator;
  value: string;
  effect: RuleEffect;
  priority: number;
};

/** Pure: create a new empty rule entry with a generated ID. */
export function createEmptyRule(): RuleEntry {
  return {
    id: `rule-${crypto.randomUUID()}`,
    field: "",
    operator: "eq",
    value: "",
    effect: "allow",
    priority: 0,
  };
}

/** Pure: update a single rule field immutably. */
export function updateRuleField<K extends keyof RuleEntry>(
  rules: RuleEntry[],
  ruleId: string,
  field: K,
  value: RuleEntry[K],
): RuleEntry[] {
  return rules.map((rule) =>
    rule.id === ruleId ? { ...rule, [field]: value } : rule,
  );
}

/** Pure: remove a rule by ID. */
export function removeRule(rules: RuleEntry[], ruleId: string): RuleEntry[] {
  return rules.filter((rule) => rule.id !== ruleId);
}

/** Pure: append a new empty rule. */
export function appendRule(rules: RuleEntry[]): RuleEntry[] {
  return [...rules, createEmptyRule()];
}

/** Pure: convert a RuleEntry to the API submission shape. */
export function ruleEntryToApiRule(entry: RuleEntry) {
  return {
    id: entry.id,
    condition: {
      field: entry.field,
      operator: entry.operator,
      value: entry.value,
    },
    effect: entry.effect,
    priority: entry.priority,
  };
}

type RuleBuilderProps = {
  rules: RuleEntry[];
  onRulesChange: (rules: RuleEntry[]) => void;
};

function FieldAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions = filterFields(value, KNOWN_FIELDS);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setShowSuggestions(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const handleSelect = (path: string) => {
    onChange(path);
    setShowSuggestions(false);
  };

  return (
    <div className="rule-builder__autocomplete" ref={containerRef}>
      <input
        type="text"
        className="rule-builder__input rule-builder__input--field"
        placeholder="Field (e.g. goal)"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="rule-builder__suggestions">
          {suggestions.map((s) => (
            <li key={s.path}>
              <button
                type="button"
                className="rule-builder__suggestion-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s.path)}
              >
                <span className="rule-builder__suggestion-path">{s.path}</span>
                <span className="rule-builder__suggestion-type">{s.type}</span>
                <span className="rule-builder__suggestion-desc">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  onUpdate,
  onRemove,
  canRemove,
}: {
  rule: RuleEntry;
  onUpdate: <K extends keyof RuleEntry>(field: K, value: RuleEntry[K]) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fieldType = lookupFieldType(rule.field, KNOWN_FIELDS);
  const availableOperators = getOperatorsForType(fieldType);
  const preview = formatRulePreview(rule.field, rule.operator, rule.value, rule.effect);

  return (
    <div className="rule-builder__row-container">
      <div className="rule-builder__row">
        <FieldAutocomplete
          value={rule.field}
          onChange={(v) => onUpdate("field", v)}
        />

        <select
          className="rule-builder__select rule-builder__select--operator"
          value={rule.operator}
          onChange={(e) => onUpdate("operator", e.target.value as RuleOperator)}
        >
          {availableOperators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        <input
          type={fieldType === "number" ? "number" : "text"}
          className="rule-builder__input rule-builder__input--value"
          placeholder="Value"
          value={rule.value}
          onChange={(e) => onUpdate("value", e.target.value)}
        />

        <select
          className="rule-builder__select rule-builder__select--effect"
          value={rule.effect}
          onChange={(e) => onUpdate("effect", e.target.value as RuleEffect)}
        >
          {EFFECTS.map((eff) => (
            <option key={eff.value} value={eff.value}>
              {eff.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="rule-builder__input rule-builder__input--priority"
          placeholder="Priority"
          value={rule.priority}
          onChange={(e) => onUpdate("priority", Number.parseInt(e.target.value, 10) || 0)}
        />

        <button
          type="button"
          className="rule-builder__remove-btn"
          onClick={onRemove}
          disabled={!canRemove}
          title="Remove rule"
        >
          Remove
        </button>
      </div>
      {preview && (
        <div className="rule-builder__preview">{preview}</div>
      )}
    </div>
  );
}

export function RuleBuilder({ rules, onRulesChange }: RuleBuilderProps) {
  const handleUpdate = (ruleId: string) => {
    return <K extends keyof RuleEntry>(field: K, value: RuleEntry[K]) => {
      onRulesChange(updateRuleField(rules, ruleId, field, value));
    };
  };

  const handleRemove = (ruleId: string) => () => {
    onRulesChange(removeRule(rules, ruleId));
  };

  const handleAdd = () => {
    onRulesChange(appendRule(rules));
  };

  return (
    <div className="rule-builder">
      <div className="rule-builder__header">
        <span className="rule-builder__label">Rules</span>
        <button
          type="button"
          className="rule-builder__add-btn"
          onClick={handleAdd}
        >
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="rule-builder__empty">
          No rules yet. Add at least one rule.
        </p>
      ) : (
        <div className="rule-builder__list">
          <div className="rule-builder__column-headers">
            <span className="rule-builder__col-label rule-builder__col-label--field">Field</span>
            <span className="rule-builder__col-label rule-builder__col-label--operator">Operator</span>
            <span className="rule-builder__col-label rule-builder__col-label--value">Value</span>
            <span className="rule-builder__col-label rule-builder__col-label--effect">Effect</span>
            <span className="rule-builder__col-label rule-builder__col-label--priority">Priority</span>
            <span className="rule-builder__col-label rule-builder__col-label--action" />
          </div>
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onUpdate={handleUpdate(rule.id)}
              onRemove={handleRemove(rule.id)}
              canRemove={rules.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
