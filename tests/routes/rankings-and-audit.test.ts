// Spec section 9.G: provisional rankings, never a declared winner.
import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("routes: competition-group rankings + audit log", () => {
  it("ranks people in a group by total, highest first, with a provisional notice", async () => {
    const app = buildApp();
    await app.ready();

    const dept = JSON.parse((await app.inject({ method: "POST", url: "/api/departments", payload: { name: "D" } })).body);
    const group = JSON.parse(
      (await app.inject({ method: "POST", url: "/api/competition-groups", payload: { name: "G" } })).body,
    );
    const rule = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/award-rules",
          payload: { name: "Contest Winner", applies_to_levels: ["ASSOCIATE"], calculation_type: "FIXED_PER_OCCURRENCE", rate: 2 },
        })
      ).body,
    );
    const year = JSON.parse((await app.inject({ method: "POST", url: "/api/award-years", payload: { year: 2026 } })).body);
    const admin = JSON.parse(
      (await app.inject({ method: "POST", url: "/api/demo-users", payload: { name: "Admin", role: "ADMIN" } })).body,
    );

    const low = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/persons",
          payload: { name: "Low Scorer", level: "ASSOCIATE", department_id: dept.id, competition_group_id: group.id },
        })
      ).body,
    );
    const high = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/persons",
          payload: { name: "High Scorer", level: "ASSOCIATE", department_id: dept.id, competition_group_id: group.id },
        })
      ).body,
    );

    await app.inject({
      method: "PUT",
      url: `/api/persons/${low.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(admin.id) },
      payload: { yearId: year.id, rawValue: 1 },
    });
    await app.inject({
      method: "PUT",
      url: `/api/persons/${high.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(admin.id) },
      payload: { yearId: year.id, rawValue: 5 },
    });

    const res = await app.inject({ method: "GET", url: `/api/competition-groups/${group.id}/rankings?yearId=${year.id}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.rankings[0].person.id).toBe(high.id);
    expect(body.rankings[1].person.id).toBe(low.id);
    expect(body.notice).toMatch(/provisional/i);

    const audit = await app.inject({ method: "GET", url: "/api/audit-log-entries" });
    expect(JSON.parse(audit.body)).toHaveLength(2);
    await app.close();
  });
});
