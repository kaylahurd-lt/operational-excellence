// GENERATED from db/schema.sql `competition_group_departments` — the many-to-many
// join between competition groups and departments (spec section 3: some
// departments are merged into one competition group for OpEx purposes).
import { getDb, type Bindable } from "../connection.js";

export interface CompetitionGroupDepartment {
  id: number;
  competition_group_id: number;
  department_id: number;
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["competition_group_id", "department_id"],
  properties: {
    competition_group_id: { type: "integer", minimum: 1 },
    department_id: { type: "integer", minimum: 1 },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    competition_group_id: { type: "integer", minimum: 1 },
    department_id: { type: "integer", minimum: 1 },
  },
} as const;

export function list(): CompetitionGroupDepartment[] {
  return getDb()
    .prepare("SELECT * FROM competition_group_departments")
    .all() as unknown as CompetitionGroupDepartment[];
}

export function get(id: number): CompetitionGroupDepartment | undefined {
  return getDb()
    .prepare("SELECT * FROM competition_group_departments WHERE id = ?")
    .get(id) as unknown as CompetitionGroupDepartment | undefined;
}

export function create(
  input: Omit<CompetitionGroupDepartment, "id">,
): CompetitionGroupDepartment {
  const stmt = getDb().prepare(
    "INSERT INTO competition_group_departments (competition_group_id, department_id) VALUES (@competition_group_id, @department_id)",
  );
  const info = stmt.run(input as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(
  id: number,
  input: Partial<Omit<CompetitionGroupDepartment, "id">>,
): CompetitionGroupDepartment | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb()
    .prepare(`UPDATE competition_group_departments SET ${set} WHERE id = @id`)
    .run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM competition_group_departments WHERE id = ?").run(id);
  return info.changes > 0;
}
