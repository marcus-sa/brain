/**
 * Dialog for creating a new policy.
 *
 * Form state management uses pure reducer-style functions.
 * Submit calls POST /api/workspaces/:workspaceId/policies.
 */

import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useWorkspaceState } from "../../stores/workspace-state";
import {
  type RuleEntry,
  RuleBuilder,
  createEmptyRule,
  ruleEntryToApiRule,
} from "./RuleBuilder";

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

type PolicyFormState = {
  title: string;
  description: string;
  agentRole: string;
  humanVetoRequired: boolean;
  maxTtl: string;
  rules: RuleEntry[];
};

type FormErrors = {
  title?: string;
  description?: string;
  rules?: string;
  submit?: string;
};

// ---------------------------------------------------------------------------
// Pure form helpers
// ---------------------------------------------------------------------------

/** Pure: create initial form state. */
function createInitialFormState(): PolicyFormState {
  return {
    title: "",
    description: "",
    agentRole: "",
    humanVetoRequired: false,
    maxTtl: "",
    rules: [createEmptyRule()],
  };
}

/** Pure: validate form and return errors (empty object = valid). */
function validateForm(state: PolicyFormState): FormErrors {
  const errors: FormErrors = {};

  if (state.title.trim() === "") {
    errors.title = "Title is required";
  }

  if (state.description.trim() === "") {
    errors.description = "Description is required";
  }

  if (state.rules.length === 0) {
    errors.rules = "At least one rule is required";
  } else {
    const hasEmptyField = state.rules.some((r) => r.field.trim() === "");
    if (hasEmptyField) {
      errors.rules = "All rules must have a non-empty field";
    }
  }

  return errors;
}

/** Pure: check whether a FormErrors object contains any errors. */
function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Pure: build the API request body from form state. */
function buildRequestBody(state: PolicyFormState) {
  const body: Record<string, unknown> = {
    title: state.title.trim(),
    description: state.description.trim(),
    rules: state.rules.map(ruleEntryToApiRule),
  };

  if (state.agentRole.trim()) {
    body.selector = { agent_role: state.agentRole.trim() };
  }

  if (state.humanVetoRequired) {
    body.human_veto_required = true;
  }

  if (state.maxTtl.trim()) {
    body.max_ttl = state.maxTtl.trim();
  }

  return body;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type CreatePolicyDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function CreatePolicyDialog({ open, onClose }: CreatePolicyDialogProps) {
  const workspaceId = useWorkspaceState((s) => s.workspaceId);
  const navigate = useNavigate();

  const [form, setForm] = useState<PolicyFormState>(createInitialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback(
    <K extends keyof PolicyFormState>(field: K, value: PolicyFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // Clear field-specific error on change
      setErrors((prev) => {
        const next = { ...prev };
        if (field === "title") delete next.title;
        if (field === "rules") delete next.rules;
        delete next.submit;
        return next;
      });
    },
    [],
  );

  const handleRulesChange = useCallback(
    (rules: RuleEntry[]) => {
      updateField("rules", rules);
    },
    [updateField],
  );

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setForm(createInitialFormState());
    setErrors({});
    onClose();
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validateForm(form);
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    if (!workspaceId) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const url = `/api/workspaces/${encodeURIComponent(workspaceId)}/policies`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(form)),
      });

      if (!response.ok) {
        const text = await response.text();
        let message: string;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          message = parsed.error ?? text;
        } catch {
          message = text;
        }
        setErrors({ submit: message || "Failed to create policy" });
        return;
      }

      const data = (await response.json()) as { policy_id: string };

      // Reset form
      setForm(createInitialFormState());
      setErrors({});
      onClose();

      // Navigate to the newly created policy
      void navigate({
        to: "/policies/$policyId",
        params: { policyId: data.policy_id },
      });
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : "Failed to create policy",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, workspaceId, onClose, navigate]);

  if (!open) return undefined;

  return (
    <div className="policy-dialog__backdrop" onClick={handleClose}>
      <div
        className="policy-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Policy"
      >
        <div className="policy-dialog__header">
          <h2>Create Policy</h2>
          <button
            type="button"
            className="policy-dialog__close-btn"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Close
          </button>
        </div>

        <div className="policy-dialog__body">
          {errors.submit && (
            <p className="policy-dialog__error">{errors.submit}</p>
          )}

          <div className="policy-dialog__field">
            <label className="policy-dialog__label" htmlFor="policy-title">
              Title <span className="policy-dialog__required">*</span>
            </label>
            <input
              id="policy-title"
              type="text"
              className="policy-dialog__input"
              placeholder="e.g. Restrict code deployment"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
            {errors.title && (
              <p className="policy-dialog__field-error">{errors.title}</p>
            )}
          </div>

          <div className="policy-dialog__field">
            <label className="policy-dialog__label" htmlFor="policy-description">
              Description <span className="policy-dialog__required">*</span>
            </label>
            <textarea
              id="policy-description"
              className={`policy-dialog__textarea${errors.description ? " policy-dialog__textarea--error" : ""}`}
              placeholder="Describe what this policy governs"
              rows={3}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          <div className="policy-dialog__row">
            <div className="policy-dialog__field policy-dialog__field--half">
              <label className="policy-dialog__label" htmlFor="policy-agent-role">
                Agent Role
              </label>
              <input
                id="policy-agent-role"
                type="text"
                className="policy-dialog__input"
                placeholder="e.g. coding_agent"
                value={form.agentRole}
                onChange={(e) => updateField("agentRole", e.target.value)}
              />
            </div>

            <div className="policy-dialog__field policy-dialog__field--half">
              <label className="policy-dialog__label" htmlFor="policy-max-ttl">
                Max TTL
              </label>
              <input
                id="policy-max-ttl"
                type="text"
                className="policy-dialog__input"
                placeholder="e.g. 1h, 30m"
                value={form.maxTtl}
                onChange={(e) => updateField("maxTtl", e.target.value)}
              />
            </div>
          </div>

          <div className="policy-dialog__field policy-dialog__field--toggle">
            <label className="policy-dialog__toggle-label">
              <input
                type="checkbox"
                checked={form.humanVetoRequired}
                onChange={(e) => updateField("humanVetoRequired", e.target.checked)}
              />
              <span>Human veto required</span>
            </label>
          </div>

          <div className="policy-dialog__rules-section">
            <RuleBuilder rules={form.rules} onRulesChange={handleRulesChange} />
            {errors.rules && (
              <p className="policy-dialog__field-error">{errors.rules}</p>
            )}
          </div>
        </div>

        <div className="policy-dialog__footer">
          <button
            type="button"
            className="policy-dialog__cancel-btn"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="policy-dialog__submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}
