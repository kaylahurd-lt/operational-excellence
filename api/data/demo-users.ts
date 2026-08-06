// GENERATED from db/schema.sql `demo_users`. `assigned_competition_group_ids`
// and `managed_person_ids` are arrays with no native SQLite type, so they are
// stored as JSON TEXT and (de)serialized here at the seam boundary — the rest
// of the app (routes, frontend) only ever sees real arrays.
import { getDb, type Bindable } from "../connection.js";

export type UserRole = "ADMIN" | "EA" | "MANAGER";

export interface DemoUser {
  id: number;
  name: string;
  role: UserRole;
  assigned_competition_group_ids: number[];
  managed_person_ids: number[];
}

interface DemoUserRow {
  id: number;
  name: string;
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

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "role"],
  properties: {
    name: { type: "string", minLength: 1 },
    role: { type: "string", enum: ["ADMIN", "EA", "MANAGER"] },
    assigned_competition_group_ids: { type: "array", items: { type: "integer" } },
    managed_person_ids: { type: "array", items: { type: "integer" } },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1 },
    role: { type: "string", enum: ["ADMIN", "EA", "MANAGER"] },
    assigned_competition_group_ids: { type: "array", items: { type: "integer" } },
    managed_person_ids: { type: "array", items: { type: "integer" } },
  },
} as const;

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

export function create(input: Omit<DemoUser, "id">): DemoUser {
  const stmt = getDb().prepare(
    "INSERT INTO demo_users (name, role, assigned_competition_group_ids, managed_person_ids) " +
      "VALUES (@name, @role, @assigned_competition_group_ids, @managed_person_ids)",
  );
  const info = stmt.run({
    name: input.name,
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
