import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as competitionGroups from "../../api/data/competition-groups.js";

freshDb();

describe("competition-groups data access", () => {
  it("creates, lists, gets, updates, and removes", () => {
    const created = competitionGroups.create({ name: "Legal & Government" });
    expect(competitionGroups.list()).toHaveLength(1);
    expect(competitionGroups.get(created.id)?.name).toBe("Legal & Government");

    const updated = competitionGroups.update(created.id, { name: "Legal & Gov 2026" });
    expect(updated?.name).toBe("Legal & Gov 2026");

    expect(competitionGroups.remove(created.id)).toBe(true);
    expect(competitionGroups.get(created.id)).toBeUndefined();
  });
});
