// Spec section 11/15: EA can edit within scope while ACTIVE; manager can
// never edit; AUDIT_LOCKED blocks EA/manager but allows admin corrections.
import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

async function seedPersonRuleYear(app: ReturnType<typeof buildApp>) {
  await app.inject({
    method: "POST",
    url: "/api/demo-users",
    payload: { name: "Seed Admin", email: "seed.admin", password: "password123", role: "ADMIN" },
  });
  const adminCookies = await loginAs(app, "seed.admin", "password123");

  const dept = JSON.parse((await app.inject({ method: "POST", url: "/api/departments", payload: { name: "D" } })).body);
  const group = JSON.parse(
    (await app.inject({ method: "POST", url: "/api/competition-groups", payload: { name: "G" } })).body,
  );
  const person = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/api/persons",
        cookies: adminCookies,
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
  return { group, person, rule, year, adminCookies };
}

describe("routes: PUT /persons/:personId/rules/:ruleId/score-input", () => {
  it("lets an EA within scope write while ACTIVE", async () => {
    const app = buildApp();
    await app.ready();
    const { group, person, rule, year, adminCookies } = await seedPersonRuleYear(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: adminCookies,
      payload: {
        name: "EA",
        email: "ea",
        password: "password123",
        role: "EA",
        assigned_competition_group_ids: [group.id],
      },
    });
    const cookies = await loginAs(app, "ea", "password123");

    const res = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      cookies,
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("403s a manager attempting to write", async () => {
    const app = buildApp();
    await app.ready();
    const { person, rule, year, adminCookies } = await seedPersonRuleYear(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: adminCookies,
      payload: {
        name: "Manager",
        email: "manager",
        password: "password123",
        role: "MANAGER",
        managed_person_ids: [person.id],
      },
    });
    const cookies = await loginAs(app, "manager", "password123");

    const res = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      cookies,
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("403s an EA once the year is AUDIT_LOCKED, but allows an admin correction", async () => {
    const app = buildApp();
    await app.ready();
    const { group, person, rule, year, adminCookies: seedAdminCookies } = await seedPersonRuleYear(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: seedAdminCookies,
      payload: {
        name: "EA",
        email: "ea",
        password: "password123",
        role: "EA",
        assigned_competition_group_ids: [group.id],
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: seedAdminCookies,
      payload: { name: "Admin", email: "admin", password: "password123", role: "ADMIN" },
    });
    const eaCookies = await loginAs(app, "ea", "password123");
    const adminCookies = await loginAs(app, "admin", "password123");

    const lock = await app.inject({
      method: "POST",
      url: `/api/award-years/${year.id}/lock`,
      cookies: adminCookies,
    });
    expect(lock.statusCode).toBe(200);
    expect(JSON.parse(lock.body).status).toBe("AUDIT_LOCKED");

    const eaAttempt = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      cookies: eaCookies,
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(eaAttempt.statusCode).toBe(403);

    const adminCorrection = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      cookies: adminCookies,
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(adminCorrection.statusCode).toBe(200);
    await app.close();
  });
});
