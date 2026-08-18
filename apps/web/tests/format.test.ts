import { describe, expect, it } from "vitest";
import { allowedTransitions, caseDisplayId, formatMoney, slaPresentation } from "@/lib/format";

describe("workflow presentation", () => {
  it("limits estimator actions while keeping manager approval", () => {
    expect(allowedTransitions("FINAL_QUOTED", "ESTIMATOR")).toEqual(["RETURN_REQUESTED"]);
    expect(allowedTransitions("FINAL_QUOTED", "MANAGER")).toContain("PAID");
  });

  it("uses the public case number when available", () => {
    expect(caseDisplayId({ id: 7, case_number: "FA-2026-0007" })).toBe("FA-2026-0007");
    expect(caseDisplayId({ id: 7 })).toBe("FA-00007");
  });

  it("formats money and overdue SLA for Thai operators", () => {
    expect(formatMoney(12500)).toContain("12,500");
    expect(slaPresentation({ state: "OVERDUE", business_days_remaining: -2 }).label).toContain("2 วัน");
  });
});
