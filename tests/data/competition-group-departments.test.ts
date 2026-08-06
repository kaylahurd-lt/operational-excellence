import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as departments from "../../api/data/departments.js";
import * as competitionGroups from "../../api/data/competition-groups.js";
import * as competitionGroupDepartments from "../../api/data/competition-group-departments.js";

freshDb();

describe("competition-group-departments data access", () => {
  it("links a merged competition group to multiple departments", () => {
    const legal = departments.create({ name: "Legal" });
    const government = departments.create({ name: "Government" });
    const group = competitionGroups.create({ name: "Legal & Government" });

    const link1 = competitionGroupDepartments.create({
      competition_group_id: group.id,
      department_id: legal.id,
    });
    competitionGroupDepartments.create({ competition_group_id: group.id, department_id: government.id });

    expect(competitionGroupDepartments.list()).toHaveLength(2);
    expect(competitionGroupDepartments.get(link1.id)?.department_id).toBe(legal.id);

    expect(competitionGroupDepartments.remove(link1.id)).toBe(true);
    expect(competitionGroupDepartments.list()).toHaveLength(1);
  });
});
