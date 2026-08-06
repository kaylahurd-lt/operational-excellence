// GENERATED from db/schema.sql `departments`. See _table.template.ts for the pattern.
import { getDb, type Bindable } from "../connection.js";

export interface Department {
  id: number;
  name: string;
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1 },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1 },
  },
} as const;

export function list(): Department[] {
  return getDb().prepare("SELECT * FROM departments").all() as unknown as Department[];
}

export function get(id: number): Department | undefined {
  return getDb().prepare("SELECT * FROM departments WHERE id = ?").get(id) as unknown as
    | Department
    | undefined;
}

export function create(input: Omit<Department, "id">): Department {
  const stmt = getDb().prepare("INSERT INTO departments (name) VALUES (@name)");
  const info = stmt.run(input as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<Department, "id">>): Department | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE departments SET ${set} WHERE id = @id`).run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM departments WHERE id = ?").run(id);
  return info.changes > 0;
}
