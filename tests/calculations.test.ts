// Confirmed examples from CLAUDE_CODE_OpEx_Prototype_Spec.md section 10.
import { describe, it, expect } from "vitest";
import {
  calculateAssociateBadgePoints,
  calculateCappedOccurrencePoints,
  calculateFixedOccurrencePoints,
  calculateManagerBadgePoints,
  calculateRulePoints,
  calculatePersonTotal,
} from "../api/domain/calculations.js";
import type { AwardRule } from "../api/data/award-rules.js";
import type { ScoreInput } from "../api/data/score-inputs.js";

describe("calculateAssociateBadgePoints", () => {
  it("sums quarterly badges and multiplies by 2", () => {
    expect(calculateAssociateBadgePoints(2, 3, 1, 4)).toBe(20);
  });
});

describe("calculateCappedOccurrencePoints", () => {
  it("caps spot bonuses at 25 points", () => {
    expect(calculateCappedOccurrencePoints(7, 5, 25)).toBe(25);
  });

  it("caps external shoutouts at 20 points", () => {
    expect(calculateCappedOccurrencePoints(15, 2, 20)).toBe(20);
  });

  it("does not cap when under the max", () => {
    expect(calculateCappedOccurrencePoints(2, 5, 25)).toBe(10);
  });
});

describe("calculateFixedOccurrencePoints", () => {
  it("multiplies occurrence count by rate", () => {
    expect(calculateFixedOccurrencePoints(1, 15)).toBe(15);
  });
});

describe("calculateManagerBadgePoints", () => {
  it("floors by default since rounding is unconfirmed", () => {
    expect(calculateManagerBadgePoints(29)).toBe(2);
  });

  it("accepts an injected rounding strategy", () => {
    expect(calculateManagerBadgePoints(29, Math.ceil)).toBe(3);
  });
});

function makeRule(overrides: Partial<AwardRule>): AwardRule {
  return {
    id: 1,
    name: "Test Rule",
    applies_to_levels: ["ASSOCIATE"],
    competition_group_ids: null,
    rate: null,
    max_points: null,
    calculation_type: "UNKNOWN",
    quarters: 0,
    formula_confirmed: 1,
    description: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScoreInput>): ScoreInput {
  return {
    id: 1,
    year_id: 1,
    person_id: 1,
    rule_id: 1,
    quarter: null,
    raw_value: 0,
    ...overrides,
  };
}

describe("calculateRulePoints", () => {
  it("marks MAPPED_SCORE_TBD as unresolved and worth 0 points", () => {
    const rule = makeRule({ id: 5, calculation_type: "MAPPED_SCORE_TBD" });
    const result = calculateRulePoints(rule, [makeInput({ rule_id: 5, raw_value: 42 })]);
    expect(result.unresolved).toBe(true);
    expect(result.points).toBe(0);
  });

  it("marks SCORE_INPUT helper rules as resolved but non-scoring", () => {
    const rule = makeRule({ id: 6, calculation_type: "SCORE_INPUT" });
    const result = calculateRulePoints(rule, [makeInput({ rule_id: 6, raw_value: 88 })]);
    expect(result.unresolved).toBe(false);
    expect(result.points).toBe(0);
  });

  it("flags BADGES_PER_POINT with a rounding-assumption note", () => {
    const rule = makeRule({ id: 7, calculation_type: "BADGES_PER_POINT", rate: 10 });
    const result = calculateRulePoints(rule, [makeInput({ rule_id: 7, raw_value: 29 })]);
    expect(result.points).toBe(2);
    expect(result.roundingAssumption).toBe(true);
  });

  it("sums multiple quarterly rows before applying the rate", () => {
    const rule = makeRule({ id: 8, calculation_type: "QUARTERLY_SUM_TIMES_RATE", rate: 2, quarters: 1 });
    const inputs = [1, 2, 3, 4].map((q) => makeInput({ rule_id: 8, quarter: q as 1 | 2 | 3 | 4, raw_value: q }));
    const result = calculateRulePoints(rule, inputs);
    expect(result.rawValue).toBe(10);
    expect(result.points).toBe(20);
  });
});

describe("calculatePersonTotal", () => {
  it("excludes unresolved rules from the total and flags hasUnresolved", () => {
    const rules = [
      makeRule({ id: 1, name: "Service Excellence Winner", calculation_type: "FIXED_PER_OCCURRENCE", rate: 15 }),
      makeRule({ id: 2, name: "Leadership Impact Points", calculation_type: "MAPPED_SCORE_TBD" }),
    ];
    const inputs = [
      makeInput({ id: 1, rule_id: 1, person_id: 1, year_id: 1, raw_value: 1 }),
      makeInput({ id: 2, rule_id: 2, person_id: 1, year_id: 1, raw_value: 50 }),
    ];
    const result = calculatePersonTotal(1, 1, rules, inputs);
    expect(result.total).toBe(15);
    expect(result.hasUnresolved).toBe(true);
  });

  it("ignores inputs belonging to other people or years", () => {
    const rules = [makeRule({ id: 1, calculation_type: "FIXED_PER_OCCURRENCE", rate: 5 })];
    const inputs = [
      makeInput({ id: 1, rule_id: 1, person_id: 2, year_id: 1, raw_value: 1 }),
      makeInput({ id: 2, rule_id: 1, person_id: 1, year_id: 2, raw_value: 1 }),
    ];
    const result = calculatePersonTotal(1, 1, rules, inputs);
    expect(result.total).toBe(0);
  });
});
