// GENERATED from db/schema.sql `persons`. See _table.template.ts for the pattern.
import { getDb, type Bindable } from "../connection.js";

export type EmployeeLevel = "ASSOCIATE" | "MANAGER" | "DIRECTOR" | "VP_AVP";

export interface Person {
  id: number;
  name: string;
  title: string | null;
  division: string | null;
  level: EmployeeLevel;
  department_id: number;
  competition_group_id: number;
  manager_id: number | null;
  active: number; // boolean (0/1)
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "level", "department_id", "competition_group_id"],
  properties: {
    name: { type: "string", minLength: 1 },
    title: { type: ["string", "null"] },
    division: { type: ["string", "null"] },
    level: { type: "string", enum: ["ASSOCIATE", "MANAGER", "DIRECTOR", "VP_AVP"] },
    department_id: { type: "integer", minimum: 1 },
    competition_group_id: { type: "integer", minimum: 1 },
    manager_id: { type: ["integer", "null"], minimum: 1 },
    active: { type: "integer", enum: [0, 1] },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1 },
    title: { type: ["string", "null"] },
    division: { type: ["string", "null"] },
    level: { type: "string", enum: ["ASSOCIATE", "MANAGER", "DIRECTOR", "VP_AVP"] },
    department_id: { type: "integer", minimum: 1 },
    competition_group_id: { type: "integer", minimum: 1 },
    manager_id: { type: ["integer", "null"], minimum: 1 },
    active: { type: "integer", enum: [0, 1] },
  },
} as const;

export type CreatePersonInput = Omit<Person, "id" | "title" | "division" | "manager_id" | "active"> &
  Partial<Pick<Person, "title" | "division" | "manager_id" | "active">>;

export function list(): Person[] {
  return getDb().prepare("SELECT * FROM persons").all() as unknown as Person[];
}

export function get(id: number): Person | undefined {
  return getDb().prepare("SELECT * FROM persons WHERE id = ?").get(id) as unknown as
    | Person
    | undefined;
}

export function create(input: CreatePersonInput): Person {
  const withDefaults = { active: 1, title: null, division: null, manager_id: null, ...input };
  const stmt = getDb().prepare(
    "INSERT INTO persons (name, title, division, level, department_id, competition_group_id, manager_id, active) " +
      "VALUES (@name, @title, @division, @level, @department_id, @competition_group_id, @manager_id, @active)",
  );
  const info = stmt.run(withDefaults as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<Person, "id">>): Person | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE persons SET ${set} WHERE id = @id`).run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM persons WHERE id = ?").run(id);
  return info.changes > 0;
}
