/**
 * Inline rule editor for policy creation.
 *
 * Each rule has a condition (field/operator/value), effect (allow/deny), and priority.
 * Pure state transformations are extracted as standalone functions.
 */

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
  return (
    <div className="rule-builder__row">
      <input
        type="text"
        className="rule-builder__input rule-builder__input--field"
        placeholder="Field (e.g. action)"
        value={rule.field}
        onChange={(e) => onUpdate("field", e.target.value)}
      />

      <select
        className="rule-builder__select rule-builder__select--operator"
        value={rule.operator}
        onChange={(e) => onUpdate("operator", e.target.value as RuleOperator)}
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      <input
        type="text"
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
