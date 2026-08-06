import { describe, it, expect } from "vitest";
import { freshDb } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

describe("routes: departments, competition-groups, competition-group-departments", () => {
  it("creates and lists reference data, and 404s on a missing department", async () => {
    const app = buildApp();
    await app.ready();

    const deptRes = await app.inject({ method: "POST", url: "/api/departments", payload: { name: "Marketing" } });
    expect(deptRes.statusCode).toBe(200);
    const department = JSON.parse(deptRes.body);

    const groupRes = await app.inject({
      method: "POST",
      url: "/api/competition-groups",
      payload: { name: "Marketing 2026" },
    });
    const group = JSON.parse(groupRes.body);

    const linkRes = await app.inject({
      method: "POST",
      url: "/api/competition-group-departments",
      payload: { competition_group_id: group.id, department_id: department.id },
    });
    expect(linkRes.statusCode).toBe(200);

    const listRes = await app.inject({ method: "GET", url: "/api/departments" });
    expect(JSON.parse(listRes.body)).toHaveLength(1);

    const missing = await app.inject({ method: "GET", url: "/api/departments/999" });
    expect(missing.statusCode).toBe(404);

    const badBody = await app.inject({ method: "POST", url: "/api/departments", payload: {} });
    expect(badBody.statusCode).toBe(400);

    await app.close();
  });
});
