// Spec section 11/15: EA can edit within scope while ACTIVE; manager can
// never edit; AUDIT_LOCKED blocks EA/manager but allows admin corrections.
import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

async function seedPersonRuleYear(app: ReturnType<typeof buildApp>) {
  const dept = JSON.parse((await app.inject({ method: "POST", url: "/api/departments", payload: { name: "D" } })).body);
  const group = JSON.parse(
    (await app.inject({ method: "POST", url: "/api/competition-groups", payload: { name: "G" } })).body,
  );
  const person = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/api/persons",
        payload: { name: "P", level: "ASSOCIATE", department_id: dept.id, competition_group_id: group.id },
      })
    ).body,
  );
  const rule = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/api/award-rules",
        payload: { name: "Buddy", applies_to_levels: ["ASSOCIATE"], calculation_type: "FIXED_PER_OCCURRENCE", rate: 5 },
      })
    ).body,
  );
  const year = JSON.parse((await app.inject({ method: "POST", url: "/api/award-years", payload: { year: 2026 } })).body);
  return { group, person, rule, year };
}

describe("routes: PUT /persons/:personId/rules/:ruleId/score-input", () => {
  it("lets an EA within scope write while ACTIVE", async () => {
    const app = buildApp();
    await app.ready();
    const { group, person, rule, year } = await seedPersonRuleYear(app);
    const ea = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo-users",
          payload: { name: "EA", role: "EA", assigned_competition_group_ids: [group.id] },
        })
      ).body,
    );

    const res = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(ea.id) },
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("403s a manager attempting to write", async () => {
    const app = buildApp();
    await app.ready();
    const { person, rule, year } = await seedPersonRuleYear(app);
    const manager = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo-users",
          payload: { name: "Manager", role: "MANAGER", managed_person_ids: [person.id] },
        })
      ).body,
    );

    const res = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(manager.id) },
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("403s an EA once the year is AUDIT_LOCKED, but allows an admin correction", async () => {
    const app = buildApp();
    await app.ready();
    const { group, person, rule, year } = await seedPersonRuleYear(app);
    const ea = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo-users",
          payload: { name: "EA", role: "EA", assigned_competition_group_ids: [group.id] },
        })
      ).body,
    );
    const admin = JSON.parse(
      (await app.inject({ method: "POST", url: "/api/demo-users", payload: { name: "Admin", role: "ADMIN" } })).body,
    );

    const lock = await app.inject({
      method: "POST",
      url: `/api/award-years/${year.id}/lock`,
      headers: { "x-demo-user-id": String(admin.id) },
    });
    expect(lock.statusCode).toBe(200);
    expect(JSON.parse(lock.body).status).toBe("AUDIT_LOCKED");

    const eaAttempt = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(ea.id) },
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(eaAttempt.statusCode).toBe(403);

    const adminCorrection = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      headers: { "x-demo-user-id": String(admin.id) },
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(adminCorrection.statusCode).toBe(200);
    await app.close();
  });
});
