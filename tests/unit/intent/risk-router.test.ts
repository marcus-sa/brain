import { describe, expect, test } from "bun:test";
import { routeByRisk } from "../../../app/src/server/intent/risk-router";
import type {
  EvaluationResult,
} from "../../../app/src/server/intent/types";

// --- Risk Router ---

describe("routeByRisk", () => {
  const approveResult = (risk_score: number): EvaluationResult => ({
    decision: "APPROVE",
    risk_score,
    reason: "Looks good",
  });

  const rejectResult = (risk_score: number): EvaluationResult => ({
    decision: "REJECT",
    risk_score,
    reason: "Too risky",
  });

  describe("auto_approve route", () => {
    test("returns auto_approve when APPROVE and risk_score is 0", () => {
      const result = routeByRisk(approveResult(0));
      expect(result).toEqual({ route: "auto_approve" });
    });

    test("returns auto_approve when APPROVE and risk_score equals threshold (30)", () => {
      const result = routeByRisk(approveResult(30));
      expect(result).toEqual({ route: "auto_approve" });
    });

    test("returns auto_approve when APPROVE and risk_score equals custom threshold", () => {
      const result = routeByRisk(approveResult(50), { threshold: 50 });
      expect(result).toEqual({ route: "auto_approve" });
    });
  });

  describe("veto_window route", () => {
    test("returns veto_window when APPROVE and risk_score is 31 (just above default threshold)", () => {
      const result = routeByRisk(approveResult(31));
      expect(result.route).toBe("veto_window");
      if (result.route === "veto_window") {
        expect(result.expires_at).toBeInstanceOf(Date);
        expect(result.expires_at.getTime()).toBeGreaterThan(Date.now());
      }
    });

    test("returns veto_window when APPROVE and risk_score is 100", () => {
      const result = routeByRisk(approveResult(100));
      expect(result.route).toBe("veto_window");
    });

    test("returns veto_window when APPROVE and risk_score is 51 with custom threshold 50", () => {
      const result = routeByRisk(approveResult(51), { threshold: 50 });
      expect(result.route).toBe("veto_window");
    });
  });

  describe("reject route", () => {
    test("returns reject when decision is REJECT regardless of low risk_score", () => {
      const result = routeByRisk(rejectResult(0));
      expect(result).toEqual({ route: "reject", reason: "Too risky" });
    });

    test("returns reject when decision is REJECT regardless of high risk_score", () => {
      const result = routeByRisk(rejectResult(100));
      expect(result).toEqual({ route: "reject", reason: "Too risky" });
    });

    test("returns reject when decision is REJECT at threshold boundary", () => {
      const result = routeByRisk(rejectResult(30));
      expect(result).toEqual({ route: "reject", reason: "Too risky" });
    });
  });
});

// --- human_veto_required ---

describe("routeByRisk with human_veto_required", () => {
  const approveResult = (risk_score: number): EvaluationResult => ({
    decision: "APPROVE",
    risk_score,
    reason: "Looks good",
  });

  test("forces veto_window when human_veto_required is true and APPROVE with low risk", () => {
    const result = routeByRisk(approveResult(0), { human_veto_required: true });
    expect(result.route).toBe("veto_window");
  });

  test("forces veto_window when human_veto_required is true and APPROVE at threshold", () => {
    const result = routeByRisk(approveResult(30), { human_veto_required: true });
    expect(result.route).toBe("veto_window");
  });

  test("does not affect reject decisions even with human_veto_required", () => {
    const rejectResult: EvaluationResult = {
      decision: "REJECT",
      risk_score: 10,
      reason: "Denied",
    };
    const result = routeByRisk(rejectResult, { human_veto_required: true });
    expect(result).toEqual({ route: "reject", reason: "Denied" });
  });
});
