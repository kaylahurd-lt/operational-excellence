import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("routes: demo-users and award-rules", () => {
  it("creates and lists demo users with array fields intact", async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: {
        name: "Manager - Accounting Team A",
        email: "manager.accounting",
        password: "password123",
        role: "MANAGER",
        managed_person_ids: [1, 2, 3],
      },
    });
    expect(res.statusCode).toBe(200);
    const created = JSON.parse(res.body);
    expect(created.managed_person_ids).toEqual([1, 2, 3]);
    expect(created.password_hash).toBeUndefined();

    const list = await app.inject({ method: "GET", url: "/api/demo-users" });
    expect(JSON.parse(list.body)).toHaveLength(1);

    const missing = await app.inject({ method: "GET", url: "/api/demo-users/999" });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("allows the first account unauthenticated (bootstrap), then requires an admin for every account after that", async () => {
    const app = buildApp();
    await app.ready();

    const first = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "First Admin", email: "first.admin", password: "password123", role: "ADMIN" },
    });
    expect(first.statusCode).toBe(200);

    const secondUnauthenticated = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Sneaky", email: "sneaky", password: "password123", role: "ADMIN" },
    });
    expect(secondUnauthenticated.statusCode).toBe(403);

    const cookies = await loginAs(app, "first.admin", "password123");
    const secondAsAdmin = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies,
      payload: { name: "EA - A", email: "ea.a", password: "password123", role: "EA" },
    });
    expect(secondAsAdmin.statusCode).toBe(200);
    await app.close();
  });

  it("lets an admin edit another account's role/scope but not a non-admin, and blocks removing your own account", async () => {
    const app = buildApp();
    await app.ready();

    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Admin", email: "admin", password: "password123", role: "ADMIN" },
    });
    const adminCookies = await loginAs(app, "admin", "password123");

    const eaRes = await app.inject({
      method: "POST",
      url: "/api/demo-users",
      cookies: adminCookies,
      payload: { name: "EA - A", email: "ea.a", password: "password123", role: "EA" },
    });
    const ea = JSON.parse(eaRes.body);

    const groupRes = await app.inject({
      method: "POST",
      url: "/api/competition-groups",
      cookies: adminCookies,
      payload: { name: "Accounting 2026" },
    });
    const group = JSON.parse(groupRes.body);

    const edited = await app.inject({
      method: "PUT",
      url: `/api/demo-users/${ea.id}`,
      cookies: adminCookies,
      payload: { assigned_competition_group_ids: [group.id] },
    });
    expect(edited.statusCode).toBe(200);
    expect(JSON.parse(edited.body).assigned_competition_group_ids).toEqual([group.id]);

    const eaCookies = await loginAs(app, "ea.a", "password123");
    const eaEditsSomeone = await app.inject({
      method: "PUT",
      url: `/api/demo-users/${ea.id}`,
      cookies: eaCookies,
      payload: { role: "ADMIN" },
    });
    expect(eaEditsSomeone.statusCode).toBe(403);

    const removeSelf = await app.inject({
      method: "DELETE",
      url: `/api/demo-users/${JSON.parse((await app.inject({ method: "GET", url: "/api/auth/me", cookies: adminCookies })).body).id}`,
      cookies: adminCookies,
    });
    expect(removeSelf.statusCode).toBe(400);

    const removeEa = await app.inject({ method: "DELETE", url: `/api/demo-users/${ea.id}`, cookies: adminCookies });
    expect(removeEa.statusCode).toBe(204);
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
