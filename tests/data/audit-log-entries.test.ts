import { describe, it, expect, beforeEach } from "vitest";
import { freshDb } from "../helpers.js";
import * as auditLogEntries from "../../api/data/audit-log-entries.js";
import * as departments from "../../api/data/departments.js";
import * as competitionGroups from "../../api/data/competition-groups.js";
import * as persons from "../../api/data/persons.js";
import * as awardRules from "../../api/data/award-rules.js";
import * as demoUsers from "../../api/data/demo-users.js";

freshDb();

// audit_log_entries has foreign keys into demo_users/persons/award_rules —
// seed real parent rows rather than raw ids (same reasoning as score-inputs).
let demoUserId: number;
let personAId: number;
let personBId: number;
let ruleId: number;

beforeEach(() => {
  const department = departments.create({ name: "D" });
  const group = competitionGroups.create({ name: "G" });
  demoUserId = demoUsers.create({ name: "Admin", role: "ADMIN", assigned_competition_group_ids: [], managed_person_ids: [] }).id;
  personAId = persons.create({
    name: "A",
    level: "ASSOCIATE",
    department_id: department.id,
    competition_group_id: group.id,
  }).id;
  personBId = persons.create({
    name: "B",
    level: "ASSOCIATE",
    department_id: department.id,
    competition_group_id: group.id,
  }).id;
  ruleId = awardRules.create({
    name: "Rule",
    applies_to_levels: ["ASSOCIATE"],
    calculation_type: "FIXED_PER_OCCURRENCE",
    rate: 15,
  }).id;
});

describe("audit-log-entries data access", () => {
  it("creates immutable entries, listable overall and per person", () => {
    auditLogEntries.create({
      timestamp: "2026-01-01T00:00:00.000Z",
      demo_user_id: demoUserId,
      person_id: personAId,
      rule_id: ruleId,
      old_raw_value: null,
      new_raw_value: 1,
      old_calculated_points: 0,
      new_calculated_points: 15,
    });
    auditLogEntries.create({
      timestamp: "2026-01-02T00:00:00.000Z",
      demo_user_id: demoUserId,
      person_id: personBId,
      rule_id: ruleId,
      old_raw_value: null,
      new_raw_value: 1,
      old_calculated_points: 0,
      new_calculated_points: 15,
    });

    expect(auditLogEntries.list()).toHaveLength(2);
    expect(auditLogEntries.listForPerson(personAId)).toHaveLength(1);
    expect(auditLogEntries.listForPerson(personBId)).toHaveLength(1);
    // no update/remove exports — entries are immutable by design
    expect((auditLogEntries as Record<string, unknown>).update).toBeUndefined();
    expect((auditLogEntries as Record<string, unknown>).remove).toBeUndefined();
  });
});
