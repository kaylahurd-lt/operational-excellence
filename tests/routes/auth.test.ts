import { describe, it, expect } from "vitest";
import { freshDb, loginAs } from "../helpers.js";
import { buildApp } from "../../api/server.js";

freshDb();

async function seedAccount(app: ReturnType<typeof buildApp>) {
  await app.inject({
    method: "POST",
    url: "/api/demo-users",
    payload: { name: "Admin User", username: "admin", password: "password123", role: "ADMIN" },
  });
}

describe("routes: /auth/login, /auth/logout, /auth/me", () => {
  it("rejects an unknown username and a wrong password", async () => {
    const app = buildApp();
    await app.ready();
    await seedAccount(app);

    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "nobody", password: "password123" },
    });
    expect(unknown.statusCode).toBe(401);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "wrong-password" },
    });
    expect(wrongPassword.statusCode).toBe(401);
    await app.close();
  });

  it("logs in, resolves the session via /auth/me, then logs out and invalidates it", async () => {
    const app = buildApp();
    await app.ready();
    await seedAccount(app);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    const loggedInUser = JSON.parse(login.body);
    expect(loggedInUser.name).toBe("Admin User");
    expect(loggedInUser.password_hash).toBeUndefined();

    const sessionCookie = login.cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();
    const cookies = { session: sessionCookie!.value };

    const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies });
    expect(me.statusCode).toBe(200);
    expect(JSON.parse(me.body).username).toBe("admin");

    await app.inject({ method: "POST", url: "/api/auth/logout", cookies });

    const meAfterLogout = await app.inject({ method: "GET", url: "/api/auth/me", cookies });
    expect(meAfterLogout.statusCode).toBe(401);
    await app.close();
  });

  it("rejects requests with no session cookie at all", async () => {
    const app = buildApp();
    await app.ready();
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
