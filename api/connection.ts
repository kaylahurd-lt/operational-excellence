// STATIC TEMPLATE — copy verbatim, do not hand-edit. (operational-excellence)
// The data-access seam's connection. SQLite is PROTOTYPE-ONLY and lives
// behind this module — the hardening team swaps it for Postgres without
// touching the front-end. Nothing outside api/data/ may import this. (ADR 0003)
//
// DEVIATION FROM THE SKILL TEMPLATE: the template specifies better-sqlite3,
// which needs a native build step (node-gyp + Python + a C++ toolchain).
// Neither is set up on this machine and installing a full build toolchain
// was out of scope for a prototype. Node 22+'s built-in `node:sqlite` has an
// equivalent synchronous API (prepare/run/get/all, named @-params,
// lastInsertRowid) with zero native compilation, so it's used here instead.
// Swapping back to better-sqlite3 later only touches this file.
// node:sqlite is loaded via createRequire, not a static `import ... from
// "node:sqlite"`: Vite/vite-node (which vitest runs on) resolves static
// imports through its own module graph, and this Vite version's builtin
// list predates node:sqlite — a static import 404s under vitest even though
// it works fine under plain `node`. require() sidesteps that resolution.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: typeof DatabaseSyncType };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? join(__dirname, "..", "data-store");
const DB_PATH = process.env.DB_PATH ?? join(DATA_DIR, "app.db");

// node:sqlite's StatementSync.run()/get()/all() are typed against this union
// (no plain `object`/`unknown`) — every api/data/*.ts module casts through it
// when binding params, since our own row/input types are always this shape.
export type Bindable = Record<string, string | number | bigint | null>;

let db: DatabaseSyncType | null = null;

export function getDb(): DatabaseSyncType {
  if (!db) {
    mkdirSync(DATA_DIR, { recursive: true }); // node:sqlite won't create the dir
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON"); // off by default in SQLite; enforce relations
  }
  return db;
}

// Runs db/schema.sql. The schema is GENERATED from the confirmed data model.
export function migrate(): void {
  const schema = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");
  getDb().exec(schema);
}

// Test-only: use an in-memory DB so unit tests need no running server or file.
export function useInMemory(): void {
  db = new DatabaseSync(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
}
