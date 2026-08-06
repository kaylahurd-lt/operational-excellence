// Every score-input edit creates an audit-log entry (spec section 5/11/15 #12).
// Centralized here so routes.ts doesn't duplicate the before/after
// calculation whenever a raw value changes.
import * as auditLogEntries from "../data/audit-log-entries.js";
import { calculateRulePoints } from "./calculations.js";
import type { AwardRule } from "../data/award-rules.js";
import type { ScoreInput } from "../data/score-inputs.js";

export function recordScoreInputChange(params: {
  demoUserId: number;
  personId: number;
  rule: AwardRule;
  oldInputsForRule: ScoreInput[];
  newInputsForRule: ScoreInput[];
  oldRawValue: number | null;
  newRawValue: number | null;
}): void {
  const oldResult = calculateRulePoints(params.rule, params.oldInputsForRule);
  const newResult = calculateRulePoints(params.rule, params.newInputsForRule);

  auditLogEntries.create({
    timestamp: new Date().toISOString(),
    demo_user_id: params.demoUserId,
    person_id: params.personId,
    rule_id: params.rule.id,
    old_raw_value: params.oldRawValue,
    new_raw_value: params.newRawValue,
    old_calculated_points: oldResult.unresolved ? 0 : oldResult.points,
    new_calculated_points: newResult.unresolved ? 0 : newResult.points,
  });
}
