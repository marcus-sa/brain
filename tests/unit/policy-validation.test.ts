/**
 * Unit tests for policy creation body validation.
 *
 * Pure function tests -- no DB, no HTTP, no side effects.
 */
import { describe, expect, it } from "bun:test";
import { validatePolicyCreateBody } from "../../app/src/server/policy/policy-validation";

describe("validatePolicyCreateBody", () => {
  // -------------------------------------------------------------------------
  // Title validation
  // -------------------------------------------------------------------------

  it("rejects empty title", () => {
    const result = validatePolicyCreateBody({
      title: "",
      rules: [{
        id: "r1",
        condition: { field: "action", operator: "eq", value: "deploy" },
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  it("rejects missing title (undefined cast)", () => {
    const result = validatePolicyCreateBody({
      title: undefined as unknown as string,
      rules: [{
        id: "r1",
        condition: { field: "action", operator: "eq", value: "deploy" },
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  it("rejects whitespace-only title", () => {
    const result = validatePolicyCreateBody({
      title: "   ",
      rules: [{
        id: "r1",
        condition: { field: "action", operator: "eq", value: "deploy" },
        effect: "deny",
        priority: 100,
      }],
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("title"))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Rules validation
  // -------------------------------------------------------------------------

  it("rejects empty rules array", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
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
      rules: [{
        id: "r1",
        condition: { field: "action", operator: "eq", value: "deploy" },
        effect: "maybe" as "allow",
        priority: 100,
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
    const result = validatePolicyCreateBody(null as unknown as { title: unknown; rules: unknown });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("request body is required"))).toBe(true);
    }
  });

  it("rejects completely malformed condition object", () => {
    const result = validatePolicyCreateBody({
      title: "Valid Title",
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
