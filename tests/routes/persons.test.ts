// Spec section 9.C/11: EA sees only assigned groups, manager sees only their
// people, admin sees everyone.
import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

async function seedTwoGroupsWithOnePersonEach(app: ReturnType<typeof buildApp>) {
  const dept = JSON.parse((await app.inject({ method: "POST", url: "/api/departments", payload: { name: "D" } })).body);
  const groupA = JSON.parse(
    (await app.inject({ method: "POST", url: "/api/competition-groups", payload: { name: "Group A" } })).body,
  );
  const groupB = JSON.parse(
    (await app.inject({ method: "POST", url: "/api/competition-groups", payload: { name: "Group B" } })).body,
  );
  const personA = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/api/persons",
        payload: { name: "A Person", level: "ASSOCIATE", department_id: dept.id, competition_group_id: groupA.id },
      })
    ).body,
  );
  const personB = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/api/persons",
        payload: { name: "B Person", level: "ASSOCIATE", department_id: dept.id, competition_group_id: groupB.id },
      })
    ).body,
  );
  return { groupA, groupB, personA, personB };
}

describe("routes: GET /persons visibility", () => {
  it("requires authentication", async () => {
    const app = buildApp();
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/persons" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("filters the list to the EA's assigned competition group", async () => {
    const app = buildApp();
    await app.ready();
    const { groupA, personA } = await seedTwoGroupsWithOnePersonEach(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: {
        name: "EA - A",
        username: "ea.a",
        password: "password123",
        role: "EA",
        assigned_competition_group_ids: [groupA.id],
      },
    });
    const cookies = await loginAs(app, "ea.a", "password123");

    const res = await app.inject({ method: "GET", url: "/api/persons", cookies });
    const list = JSON.parse(res.body);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(personA.id);
    await app.close();
  });

  it("gives admin every person", async () => {
    const app = buildApp();
    await app.ready();
    await seedTwoGroupsWithOnePersonEach(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: { name: "Admin", username: "admin", password: "password123", role: "ADMIN" },
    });
    const cookies = await loginAs(app, "admin", "password123");

    const res = await app.inject({ method: "GET", url: "/api/persons", cookies });
    expect(JSON.parse(res.body)).toHaveLength(2);
    await app.close();
  });

  it("403s a person outside the caller's scope", async () => {
    const app = buildApp();
    await app.ready();
    const { groupA, personB } = await seedTwoGroupsWithOnePersonEach(app);
    await app.inject({
      method: "POST",
      url: "/api/demo-users",
      payload: {
        name: "EA - A",
        username: "ea.a",
        password: "password123",
        role: "EA",
        assigned_competition_group_ids: [groupA.id],
      },
    });
    const cookies = await loginAs(app, "ea.a", "password123");

    const res = await app.inject({ method: "GET", url: `/api/persons/${personB.id}`, cookies });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
