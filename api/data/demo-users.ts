// GENERATED from db/schema.sql `demo_users`. `assigned_competition_group_ids`
// and `managed_person_ids` are arrays with no native SQLite type, so they are
// stored as JSON TEXT and (de)serialized here at the seam boundary — the rest
// of the app (routes, frontend) only ever sees real arrays.
//
// `password_hash` is real login data (see api/domain/auth.ts) - list()/get()
// return it because plenty of internal code needs the rest of the row, but
// routes.ts MUST run every response through auth.toPublicUser() before it
// reaches the client. Never add a route that returns a DemoUser directly.
import { getDb, type Bindable } from "../connection.js";

export type UserRole = "ADMIN" | "EA" | "MANAGER";

export interface DemoUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  assigned_competition_group_ids: number[];
  managed_person_ids: number[];
}

interface DemoUserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  assigned_competition_group_ids: string | null;
  managed_person_ids: string | null;
}

function fromRow(row: DemoUserRow): DemoUser {
  return {
    ...row,
    assigned_competition_group_ids: row.assigned_competition_group_ids
      ? JSON.parse(row.assigned_competition_group_ids)
      : [],
    managed_person_ids: row.managed_person_ids ? JSON.parse(row.managed_person_ids) : [],
  };
}

export function list(): DemoUser[] {
  const rows = getDb().prepare("SELECT * FROM demo_users").all() as unknown as DemoUserRow[];
  return rows.map(fromRow);
}

export function get(id: number): DemoUser | undefined {
  const row = getDb().prepare("SELECT * FROM demo_users WHERE id = ?").get(id) as unknown as
    | DemoUserRow
    | undefined;
  return row ? fromRow(row) : undefined;
}

export function findByEmail(email: string): DemoUser | undefined {
  const row = getDb().prepare("SELECT * FROM demo_users WHERE email = ?").get(email) as unknown as
    | DemoUserRow
    | undefined;
  return row ? fromRow(row) : undefined;
}

export interface CreateDemoUserInput {
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  assigned_competition_group_ids?: number[];
  managed_person_ids?: number[];
}

export function create(input: CreateDemoUserInput): DemoUser {
  const stmt = getDb().prepare(
    "INSERT INTO demo_users (name, email, password_hash, role, assigned_competition_group_ids, managed_person_ids) " +
      "VALUES (@name, @email, @password_hash, @role, @assigned_competition_group_ids, @managed_person_ids)",
  );
  const info = stmt.run({
    name: input.name,
    email: input.email,
    password_hash: input.password_hash,
    role: input.role,
    assigned_competition_group_ids: JSON.stringify(input.assigned_competition_group_ids ?? []),
    managed_person_ids: JSON.stringify(input.managed_person_ids ?? []),
  } as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<DemoUser, "id">>): DemoUser | undefined {
  const patch: Record<string, unknown> = { ...input };
  if ("assigned_competition_group_ids" in patch) {
    patch.assigned_competition_group_ids = JSON.stringify(patch.assigned_competition_group_ids);
  }
  if ("managed_person_ids" in patch) {
    patch.managed_person_ids = JSON.stringify(patch.managed_person_ids);
  }
  const keys = Object.keys(patch);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb()
    .prepare(`UPDATE demo_users SET ${set} WHERE id = @id`)
    .run({ ...patch, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM demo_users WHERE id = ?").run(id);
  return info.changes > 0;
}
