// The confirmed happy path (spec sections 9.C/9.D/15, updated for real
// login): an EA logs in, enters a raw score for an associate they're
// assigned to, and the person's calculated Total reflects it immediately —
// without the EA ever touching a "Total" field directly. Drives the built
// Fastify app in-process.
import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("happy path: EA enters a score, person Total updates", () => {
  it("completes the main flow end to end", async () => {
    const app = buildApp();
    await app.ready();

    const dept = await app.inject({ method: "POST", url: "/api/departments", payload: { name: "Accounting" } });
    const department = JSON.parse(dept.body);

    const group = await app.inject({
      method: "POST",
      url: "/api/competition-groups",
      payload: { name: "Accounting 2026" },
    });
    const competitionGroup = JSON.parse(group.body);

    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Seed Admin", email: "seed.admin", password: "password123", role: "ADMIN" },
    });
    const adminCookies = await loginAs(app, "seed.admin", "password123");

    const personRes = await app.inject({
      method: "POST",
      url: "/api/persons",
      cookies: adminCookies,
      payload: {
        name: "Jordan Rivera",
        level: "ASSOCIATE",
        department_id: department.id,
        competition_group_id: competitionGroup.id,
      },
    });
    expect(personRes.statusCode).toBe(200);
    const person = JSON.parse(personRes.body);

    const ruleRes = await app.inject({
      method: "POST",
      url: "/api/award-rules",
      payload: {
        name: "Service Excellence Winner",
        applies_to_levels: ["ASSOCIATE"],
        calculation_type: "FIXED_PER_OCCURRENCE",
        rate: 15,
      },
    });
    const rule = JSON.parse(ruleRes.body);

    const yearRes = await app.inject({ method: "POST", url: "/api/award-years", payload: { year: 2026 } });
    const year = JSON.parse(yearRes.body);

    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: adminCookies,
      payload: {
        name: "EA - Accounting",
        email: "ea.accounting",
        password: "correct-horse-battery-staple",
        role: "EA",
        assigned_competition_group_ids: [competitionGroup.id],
      },
    });

    // The EA logs in for real - no persona switcher, no header shortcut.
    const cookies = await loginAs(app, "ea.accounting", "correct-horse-battery-staple");

    // Before any input, the person's total is 0.
    const before = await app.inject({
      method: "GET",
      url: `/api/persons/${person.id}/summary?yearId=${year.id}`,
      cookies,
    });
    expect(before.statusCode).toBe(200);
    expect(JSON.parse(before.body).total).toBe(0);

    // The EA enters that this associate won Service Excellence.
    const write = await app.inject({
      method: "PUT",
      url: `/api/persons/${person.id}/rules/${rule.id}/score-input`,
      cookies,
      payload: { yearId: year.id, rawValue: 1 },
    });
    expect(write.statusCode).toBe(200);

    // The Total reflects it immediately, with no "Total" field ever written.
    const after = await app.inject({
      method: "GET",
      url: `/api/persons/${person.id}/summary?yearId=${year.id}`,
      cookies,
    });
    expect(after.statusCode).toBe(200);
    const summary = JSON.parse(after.body);
    expect(summary.total).toBe(15);
    expect(summary.hasUnresolved).toBe(false);

    // The edit left an audit trail.
    const audit = await app.inject({ method: "GET", url: `/api/persons/${person.id}/audit-log-entries` });
    expect(audit.statusCode).toBe(200);
    const entries = JSON.parse(audit.body);
    expect(entries.length).toBe(1);
    expect(entries[0].new_calculated_points).toBe(15);

    await app.close();
  });
});
