// Spec section 4: lock/unlock/archive transitions and rollover are admin-only.
import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("routes: award-year lifecycle + rollover", () => {
  it("blocks a non-admin from locking a year", async () => {
    const app = buildApp();
    await app.ready();
    const year = JSON.parse((await app.inject({ method: "POST", url: "/api/award-years", payload: { year: 2026 } })).body);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "EA", email: "ea", password: "password123", role: "EA" },
    });
    const cookies = await loginAs(app, "ea", "password123");

    const res = await app.inject({ method: "POST", url: `/api/award-years/${year.id}/lock`, cookies });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("archives, then rejects a second rollover onto an existing year", async () => {
    const app = buildApp();
    await app.ready();
    const year2026 = JSON.parse(
      (await app.inject({ method: "POST", url: "/api/award-years", payload: { year: 2026 } })).body,
    );
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Admin", email: "admin", password: "password123", role: "ADMIN" },
    });
    const cookies = await loginAs(app, "admin", "password123");

    const rollover = await app.inject({
      method: "POST",
      url: `/api/award-years/${year2026.id}/rollover`,
      cookies,
    });
    expect(rollover.statusCode).toBe(200);
    expect(JSON.parse(rollover.body).createdYear.year).toBe(2027);

    const secondRollover = await app.inject({
      method: "POST",
      url: `/api/award-years/${year2026.id}/rollover`,
      cookies,
    });
    expect(secondRollover.statusCode).toBe(400);

    const archive = await app.inject({
      method: "POST",
      url: `/api/award-years/${year2026.id}/archive`,
      cookies,
    });
    expect(JSON.parse(archive.body).status).toBe("ARCHIVED");
    await app.close();
  });
});
