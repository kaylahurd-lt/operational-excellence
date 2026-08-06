import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as departments from "../../api/data/departments.js";

freshDb();

describe("departments data access", () => {
  it("creates, lists, gets, updates, and removes", () => {
    const created = departments.create({ name: "Accounting" });
    expect(created.id).toBeTypeOf("number");
    expect(departments.list()).toHaveLength(1);
    expect(departments.get(created.id)?.name).toBe("Accounting");

    const updated = departments.update(created.id, { name: "Accounting & Finance" });
    expect(updated?.name).toBe("Accounting & Finance");

    expect(departments.remove(created.id)).toBe(true);
    expect(departments.get(created.id)).toBeUndefined();
  });
});
