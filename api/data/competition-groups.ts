// GENERATED from db/schema.sql `competition_groups`. See _table.template.ts for the pattern.
import { getDb, type Bindable } from "../connection.js";

export interface CompetitionGroup {
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

export function list(): CompetitionGroup[] {
  return getDb().prepare("SELECT * FROM competition_groups").all() as unknown as CompetitionGroup[];
}

export function get(id: number): CompetitionGroup | undefined {
  return getDb().prepare("SELECT * FROM competition_groups WHERE id = ?").get(id) as unknown as
    | CompetitionGroup
    | undefined;
}

export function create(input: Omit<CompetitionGroup, "id">): CompetitionGroup {
  const stmt = getDb().prepare("INSERT INTO competition_groups (name) VALUES (@name)");
  const info = stmt.run(input as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(
  id: number,
  input: Partial<Omit<CompetitionGroup, "id">>,
): CompetitionGroup | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb()
    .prepare(`UPDATE competition_groups SET ${set} WHERE id = @id`)
    .run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM competition_groups WHERE id = ?").run(id);
  return info.changes > 0;
}
