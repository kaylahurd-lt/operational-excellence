import { describe, it, expect, beforeEach } from "vitest";
import { freshDb } from "../helpers.js";
import * as scoreInputs from "../../api/data/score-inputs.js";
import * as departments from "../../api/data/departments.js";
import * as competitionGroups from "../../api/data/competition-groups.js";
import * as persons from "../../api/data/persons.js";
import * as awardRules from "../../api/data/award-rules.js";
import * as awardYears from "../../api/data/award-years.js";

freshDb();

// score_inputs has foreign keys into persons/award_rules/award_years, enforced
// (PRAGMA foreign_keys = ON in api/connection.ts) — every test seeds real
// parent rows rather than raw ids.
let personId: number;
let ruleId: number;
let otherRuleId: number;
let yearId: number;

beforeEach(() => {
  const department = departments.create({ name: "D" });
  const group = competitionGroups.create({ name: "G" });
  personId = persons.create({
    name: "P",
    level: "ASSOCIATE",
    department_id: department.id,
    competition_group_id: group.id,
  }).id;
  ruleId = awardRules.create({
    name: "Rule A",
    applies_to_levels: ["ASSOCIATE"],
    calculation_type: "FIXED_PER_OCCURRENCE",
    rate: 5,
  }).id;
  otherRuleId = awardRules.create({
    name: "Rule B",
    applies_to_levels: ["ASSOCIATE"],
    calculation_type: "FIXED_PER_OCCURRENCE",
    rate: 2,
  }).id;
  yearId = awardYears.create({ year: 2026 }).id;
});

describe("score-inputs data access", () => {
  it("creates, finds by composite key, and lists for a year", () => {
    const created = scoreInputs.create({ year_id: yearId, person_id: personId, rule_id: ruleId, raw_value: 3 });
    expect(created.quarter).toBeNull();

    const found = scoreInputs.findOne(yearId, personId, ruleId, null);
    expect(found?.id).toBe(created.id);

    scoreInputs.create({ year_id: yearId, person_id: personId, rule_id: otherRuleId, quarter: 1, raw_value: 2 });
    expect(scoreInputs.listForYear(yearId)).toHaveLength(2);
    expect(scoreInputs.listForYear(9999)).toHaveLength(0);
  });

  it("updates the raw value and removes", () => {
    const created = scoreInputs.create({ year_id: yearId, person_id: personId, rule_id: ruleId, raw_value: 1 });
    const updated = scoreInputs.update(created.id, { raw_value: 4 });
    expect(updated?.raw_value).toBe(4);

    expect(scoreInputs.remove(created.id)).toBe(true);
    expect(scoreInputs.get(created.id)).toBeUndefined();
  });
});
