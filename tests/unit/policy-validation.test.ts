/**
 * Unit tests for policy creation body validation.
 *
 * Pure function tests -- no DB, no HTTP, no side effects.
 */
import { describe, expect, it } from "bun:test";
import { validatePolicyCreateBody } from "../../app/src/server/policy/policy-validation";

const validRule = {
  id: "r1",
  condition: { field: "action", operator: "eq", value: "deploy" },
  effect: "deny",
  priority: 100,
};

describe("validatePolicyCreateBody", () => {
  // -------------------------------------------------------------------------
  // Title validation
  // -------------------------------------------------------------------------

  it("rejects empty title", () => {
    const result = validatePolicyCreateBody({
      title: "",
      description: "Valid description",
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  it("rejects missing title (undefined cast)", () => {
    const result = validatePolicyCreateBody({
      title: undefined as unknown as string,
      description: "Valid description",
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  it("rejects whitespace-only title", () => {
    const result = validatePolicyCreateBody({
      title: "   ",
      description: "Valid description",
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Description validation
  // -------------------------------------------------------------------------

  it("rejects empty description", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "",
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    }
  });

  it("rejects missing description (undefined cast)", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: undefined as unknown as string,
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    }
  });

  it("rejects whitespace-only description", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "   ",
      rules: [validRule],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("description"))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Rules validation
  // -------------------------------------------------------------------------

  it("rejects empty rules array", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("rule"))).toBe(true);
    }
  });

  it("rejects missing rules (undefined cast)", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: undefined as unknown as [],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("rule"))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Effect validation
  // -------------------------------------------------------------------------

  it("rejects invalid effect value", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        ...validRule,
        effect: "maybe" as "allow",
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("effect"))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Predicate structure validation
  // -------------------------------------------------------------------------

  it("rejects predicate missing field", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        id: "r1",
        condition: { operator: "eq", value: "deploy" } as unknown,
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
  });

  it("rejects predicate missing operator", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        id: "r1",
        condition: { field: "action", value: "deploy" } as unknown,
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
  });

  it("rejects predicate with invalid operator", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        id: "r1",
        condition: { field: "action", operator: "like", value: "deploy" } as unknown,
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
  });

  it("rejects empty condition array", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        id: "r1",
        condition: [] as unknown,
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("condition"))).toBe(true);
    }
  });

  it("rejects null body", () => {
    const result = validatePolicyCreateBody(null as unknown as { title: unknown; description: unknown; rules: unknown });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("request body is required"))).toBe(true);
    }
  });

  it("rejects completely malformed condition object", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
      description: "Valid description",
      rules: [{
        id: "r1",
        condition: { invalid: "structure" } as unknown,
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Valid inputs
  // -------------------------------------------------------------------------

  it("accepts valid body with single rule", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Policy",
      description: "A valid policy description",
      rules: [{
        id: "r1",
        condition: { field: "action_spec.action", operator: "eq", value: "deploy" },
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(true);
  });

  it("accepts valid body with array condition (AND logic)", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Policy",
      description: "A valid policy description",
      rules: [{
        id: "r1",
        condition: [
          { field: "action_spec.action", operator: "eq", value: "deploy" },
          { field: "budget_limit.amount", operator: "gt", value: 1000 },
        ],
        effect: "allow",
        priority: 50,
      }],
    });

    expect(result.valid).toBe(true);
  });

  it("accepts all valid operators", () => {
    const operators = ["eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "exists"];
    for (const operator of operators) {
      const result = validatePolicyCreateBody({
        title: "Valid Policy",
        description: "A valid policy description",
        rules: [{
          id: "r1",
          condition: { field: "some_field", operator, value: "test" },
          effect: "deny",
          priority: 100,
        }],
      });
      expect(result.valid).toBe(true);
    }
  });
});
