import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("routes: demo-users and award-rules", () => {
  it("creates and lists demo users with array fields intact", async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Manager - Accounting Team A", role: "MANAGER", managed_person_ids: [1, 2, 3] },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).managed_person_ids).toEqual([1, 2, 3]);

    const list = await app.inject({ method: "GET", url: "/api/demo-users" });
    expect(JSON.parse(list.body)).toHaveLength(1);

    const missing = await app.inject({ method: "GET", url: "/api/demo-users/999" });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("creates award rules and rejects an invalid calculation_type", async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/award-rules",
      payload: {
        name: "External Shoutout",
        applies_to_levels: ["ASSOCIATE"],
        calculation_type: "CAPPED_PER_OCCURRENCE",
        rate: 2,
        max_points: 20,
      },
    });
    expect(res.statusCode).toBe(200);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/award-rules",
      payload: { name: "Bad Rule", applies_to_levels: ["ASSOCIATE"], calculation_type: "NOT_A_REAL_TYPE" },
    });
    expect(invalid.statusCode).toBe(400);

    expect(JSON.parse((await app.inject({ method: "GET", url: "/api/award-rules" })).body)).toHaveLength(1);
    await app.close();
  });
});
