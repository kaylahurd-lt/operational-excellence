// Pure calculation engine (spec section 10). No I/O — every function here is
// deterministic given its inputs, which is what makes it unit-testable without
// a database. Dispatched by api/routes.ts when it assembles a person's summary.
//
// Rules this module enforces:
//   - raw helper inputs never produce their own points (SCORE_INPUT rules are
//     data capture only, e.g. "Leadership Impact Score" awaiting a mapping)
//   - unknown/TBD formulas (MAPPED_SCORE_TBD, UNKNOWN) never guess a point
//     value — they return `unresolved: true` and contribute 0 to the total
//   - only calculation_type values with a confirmed formula count toward Total
import type { AwardRule } from "../data/award-rules.js";
import type { ScoreInput } from "../data/score-inputs.js";

export type RoundingStrategy = (value: number) => number;

export const FLOOR_ROUNDING: RoundingStrategy = Math.floor;

export function calculateAssociateBadgePoints(
  q1: number,
  q2: number,
  q3: number,
  q4: number,
): number {
  return (q1 + q2 + q3 + q4) * 2;
}

export function calculateFixedOccurrencePoints(count: number, rate: number): number {
  return count * rate;
}

export function calculateCappedOccurrencePoints(count: number, rate: number, max: number): number {
  return Math.min(count * rate, max);
}

// "1pt/10bdgs" — the source doesn't confirm rounding, so the strategy is
// injectable and defaults to floor. Flagged as a prototype assumption
// wherever this result surfaces in the UI, per spec section 6.
export function calculateManagerBadgePoints(
  totalBadges: number,
  roundingStrategy: RoundingStrategy = FLOOR_ROUNDING,
): number {
  return roundingStrategy(totalBadges / 10);
}

export interface RuleCalculationResult {
  ruleId: number;
  ruleName: string;
  rawValue: number;
  points: number;
  unresolved: boolean;
  roundingAssumption: boolean;
  note?: string;
}

// One rule + all its score_inputs (1 row normally, up to 4 for quarterly rules)
// for a single person/year, dispatched by calculation_type.
export function calculateRulePoints(
  rule: AwardRule,
  inputsForRule: ScoreInput[],
): RuleCalculationResult {
  const rawTotal = inputsForRule.reduce((sum, i) => sum + i.raw_value, 0);
  const base: Omit<RuleCalculationResult, "points" | "unresolved" | "roundingAssumption"> = {
    ruleId: rule.id,
    ruleName: rule.name,
    rawValue: rawTotal,
  };

  switch (rule.calculation_type) {
    case "FIXED_PER_OCCURRENCE":
      return {
        ...base,
        points: calculateFixedOccurrencePoints(rawTotal, rule.rate ?? 0),
        unresolved: false,
        roundingAssumption: false,
      };

    case "CAPPED_PER_OCCURRENCE":
      return {
        ...base,
        points: calculateCappedOccurrencePoints(rawTotal, rule.rate ?? 0, rule.max_points ?? Infinity),
        unresolved: false,
        roundingAssumption: false,
      };

    case "QUARTERLY_SUM_TIMES_RATE":
      return {
        ...base,
        points: rawTotal * (rule.rate ?? 0),
        unresolved: false,
        roundingAssumption: false,
      };

    case "BADGES_PER_POINT":
      return {
        ...base,
        points: calculateManagerBadgePoints(rawTotal, FLOOR_ROUNDING),
        unresolved: false,
        roundingAssumption: true,
        note: "Prototype assumption - rounding TBD",
      };

    case "SCORE_INPUT":
      // Deliberate data-capture rule (e.g. a raw engagement/leadership score).
      // Never itself point-producing; a sibling MAPPED_SCORE_TBD rule maps it.
      return { ...base, points: 0, unresolved: false, roundingAssumption: false };

    case "MAPPED_SCORE_TBD":
    case "UNKNOWN":
    default:
      return {
        ...base,
        points: 0,
        unresolved: true,
        roundingAssumption: false,
        note: "TBD - not included in total",
      };
  }
}

export interface PersonTotalResult {
  personId: number;
  yearId: number;
  total: number;
  breakdown: RuleCalculationResult[];
  hasUnresolved: boolean;
}

// Groups the person's score_inputs by rule (quarterly rules have up to 4 rows
// per rule) and sums confirmed points into a Total. Total NEVER includes
// unresolved rules (spec section 10) — the caller surfaces hasUnresolved so
// the UI can show a warning per spec section 9.B/9.D.
export function calculatePersonTotal(
  personId: number,
  yearId: number,
  rules: AwardRule[],
  inputs: ScoreInput[],
): PersonTotalResult {
  const inputsByRule = new Map<number, ScoreInput[]>();
  for (const input of inputs) {
    if (input.person_id !== personId || input.year_id !== yearId) continue;
    const bucket = inputsByRule.get(input.rule_id) ?? [];
    bucket.push(input);
    inputsByRule.set(input.rule_id, bucket);
  }

  const breakdown = rules.map((rule) => calculateRulePoints(rule, inputsByRule.get(rule.id) ?? []));
  const total = breakdown.reduce((sum, r) => sum + (r.unresolved ? 0 : r.points), 0);
  const hasUnresolved = breakdown.some((r) => r.unresolved && inputsByRule.has(r.ruleId));

  return { personId, yearId, total, breakdown, hasUnresolved };
}
