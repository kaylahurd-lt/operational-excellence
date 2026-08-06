// STATIC TEMPLATE — copy verbatim. (operational-excellence)
// Shared test setup. Uses an in-memory SQLite DB so unit tests verify logic
// without a running server or any file — this is how we "verify with tests"
// when the builder can't run anything locally.
import { beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDb, useInMemory } from "../api/connection.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function freshDb() {
  beforeEach(() => {
    useInMemory();
    const schema = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");
    getDb().exec(schema);
  });
}
