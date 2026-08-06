// STATIC TEMPLATE — copy verbatim. (operational-excellence)
// Shared test setup. Uses an in-memory SQLite DB so unit tests verify logic
// without a running server or any file — this is how we "verify with tests"
// when the builder can't run anything locally.
import { beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { getDb, useInMemory } from "../api/connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function freshDb() {
  beforeEach(() => {
    useInMemory();
    const schema = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");
    getDb().exec(schema);
  });
}

// Real login now (api/domain/auth.ts) - route tests log in for real instead
// of sending an x-demo-user-id header. Returns the cookie map app.inject()
// expects for every subsequent authenticated request.
export async function loginAs(
  app: FastifyInstance,
  username: string,
  password: string,
): Promise<{ session: string }> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
  if (res.statusCode !== 200) {
    throw new Error(`login as ${username} failed: ${res.statusCode} ${res.body}`);
  }
  const sessionCookie = res.cookies.find((c) => c.name === "session");
  if (!sessionCookie) throw new Error(`login as ${username} did not set a session cookie`);
  return { session: sessionCookie.value };
}
