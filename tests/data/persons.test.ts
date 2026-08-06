import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as departments from "../../api/data/departments.js";
import * as competitionGroups from "../../api/data/competition-groups.js";
import * as persons from "../../api/data/persons.js";

freshDb();

describe("persons data access", () => {
  it("creates with defaults, lists, gets, updates, and removes", () => {
    const department = departments.create({ name: "Technology" });
    const group = competitionGroups.create({ name: "Technology 2026" });

    const created = persons.create({
      name: "Sam Okafor",
      level: "ASSOCIATE",
      department_id: department.id,
      competition_group_id: group.id,
    });
    expect(created.active).toBe(1);
    expect(created.title).toBeNull();
    expect(created.manager_id).toBeNull();

    expect(persons.list()).toHaveLength(1);
    expect(persons.get(created.id)?.name).toBe("Sam Okafor");

    const manager = persons.create({
      name: "Priya Nair",
      level: "MANAGER",
      department_id: department.id,
      competition_group_id: group.id,
    });
    const updated = persons.update(created.id, { manager_id: manager.id, title: "Support Analyst" });
    expect(updated?.manager_id).toBe(manager.id);
    expect(updated?.title).toBe("Support Analyst");

    expect(persons.remove(created.id)).toBe(true);
    expect(persons.get(created.id)).toBeUndefined();
  });
});
