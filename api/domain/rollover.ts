// Rollover (spec section 4). Per the CONFIRMED data model (spec section 5),
// departments, competition_groups, persons, demo_users (access assignments),
// and award_rules carry NO year_id — they're shared org config, not
// per-year snapshots. Only score_inputs are year-scoped. That means
// "copy departments/groups/people/manager relationships/access/rules" is
// already true by construction: every year reads the same shared tables.
// The only real rollover action is creating the new AwardYear row — the new
// year automatically starts with zero score_inputs, and the prior year's
// score_inputs are untouched (spec: "preserve the prior year unchanged").
//
// This is a deliberate prototype assumption (spec section 4: "must be easy to
// change later") — if a future requirement needs rules or access to differ
// per year, award_rules/demo_users would need a year_id added and this
// function would need to actually copy rows.
import * as awardYears from "../data/award-years.js";
import type { AwardYear } from "../data/award-years.js";

export interface RolloverResult {
  createdYear: AwardYear;
  sourceYear: AwardYear;
}

export function rolloverYear(sourceYearId: number): RolloverResult {
  const sourceYear = awardYears.get(sourceYearId);
  if (!sourceYear) {
    throw new Error(`Award year ${sourceYearId} not found`);
  }

  const targetYearNumber = sourceYear.year + 1;
  const existing = awardYears.list().find((y) => y.year === targetYearNumber);
  if (existing) {
    throw new Error(`Award year ${targetYearNumber} already exists`);
  }

  const createdYear = awardYears.create({ year: targetYearNumber, status: "ACTIVE" });
  return { createdYear, sourceYear };
}
