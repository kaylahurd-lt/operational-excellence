import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as demoUsers from "../../api/data/demo-users.js";

freshDb();

describe("demo-users data access", () => {
  it("round-trips assigned/managed id arrays through JSON storage", () => {
    const created = demoUsers.create({
      name: "EA - Legal & Government",
      email: "ea.legalgov",
      password_hash: "test-hash",
      role: "EA",
      assigned_competition_group_ids: [1, 2],
      managed_person_ids: [],
    });
    expect(created.assigned_competition_group_ids).toEqual([1, 2]);

    expect(demoUsers.get(created.id)?.assigned_competition_group_ids).toEqual([1, 2]);
    expect(demoUsers.list()).toHaveLength(1);

    const updated = demoUsers.update(created.id, { managed_person_ids: [10, 11, 12] });
    expect(updated?.managed_person_ids).toEqual([10, 11, 12]);
    expect(updated?.assigned_competition_group_ids).toEqual([1, 2]);

    expect(demoUsers.remove(created.id)).toBe(true);
    expect(demoUsers.get(created.id)).toBeUndefined();
  });

  it("finds by email for login lookup", () => {
    demoUsers.create({ name: "Admin User", email: "admin", password_hash: "test-hash", role: "ADMIN" });
    expect(demoUsers.findByEmail("admin")?.name).toBe("Admin User");
    expect(demoUsers.findByEmail("nobody")).toBeUndefined();
  });

  it("defaults assigned/managed arrays to empty when omitted", () => {
    const created = demoUsers.create({ name: "Admin User", email: "admin2", password_hash: "test-hash", role: "ADMIN" });
    expect(created.assigned_competition_group_ids).toEqual([]);
    expect(created.managed_person_ids).toEqual([]);
  });
});
