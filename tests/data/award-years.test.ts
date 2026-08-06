import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import * as awardYears from "../../api/data/award-years.js";

freshDb();

describe("award-years data access", () => {
  it("defaults new years to ACTIVE and supports status transitions", () => {
    const created = awardYears.create({ year: 2026 });
    expect(created.status).toBe("ACTIVE");

    expect(awardYears.list()).toHaveLength(1);
    expect(awardYears.get(created.id)?.year).toBe(2026);

    const locked = awardYears.update(created.id, { status: "AUDIT_LOCKED" });
    expect(locked?.status).toBe("AUDIT_LOCKED");

    expect(awardYears.remove(created.id)).toBe(true);
  });

  it("accepts an explicit status on create", () => {
    const created = awardYears.create({ year: 2025, status: "ARCHIVED" });
    expect(created.status).toBe("ARCHIVED");
  });
});
