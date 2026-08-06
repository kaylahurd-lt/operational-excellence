// GENERATED from db/schema.sql `score_inputs`. See _table.template.ts for the pattern.
// This is the ONLY editable raw/helper data — calculated Total is never stored
// here or anywhere (spec section 5): it's derived at read time by
// api/domain/calculations.ts from these rows + api/data/award-rules.ts.
import { getDb, type Bindable } from "../connection.js";

export interface ScoreInput {
  id: number;
  year_id: number;
  person_id: number;
  rule_id: number;
  quarter: 1 | 2 | 3 | 4 | null;
  raw_value: number;
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["year_id", "person_id", "rule_id", "raw_value"],
  properties: {
    year_id: { type: "integer", minimum: 1 },
    person_id: { type: "integer", minimum: 1 },
    rule_id: { type: "integer", minimum: 1 },
    quarter: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
    raw_value: { type: "number", minimum: 0 },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    year_id: { type: "integer", minimum: 1 },
    person_id: { type: "integer", minimum: 1 },
    rule_id: { type: "integer", minimum: 1 },
    quarter: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
    raw_value: { type: "number", minimum: 0 },
  },
} as const;

export type CreateScoreInputInput = Omit<ScoreInput, "id" | "quarter"> & Partial<Pick<ScoreInput, "quarter">>;

export function list(): ScoreInput[] {
  return getDb().prepare("SELECT * FROM score_inputs").all() as unknown as ScoreInput[];
}

export function get(id: number): ScoreInput | undefined {
  return getDb().prepare("SELECT * FROM score_inputs WHERE id = ?").get(id) as unknown as
    | ScoreInput
    | undefined;
}

export function findOne(
  year_id: number,
  person_id: number,
  rule_id: number,
  quarter: number | null,
): ScoreInput | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM score_inputs WHERE year_id = ? AND person_id = ? AND rule_id = ? AND quarter IS ?",
    )
    .get(year_id, person_id, rule_id, quarter) as unknown as ScoreInput | undefined;
}

export function listForYear(year_id: number): ScoreInput[] {
  return getDb()
    .prepare("SELECT * FROM score_inputs WHERE year_id = ?")
    .all(year_id) as unknown as ScoreInput[];
}

export function create(input: CreateScoreInputInput): ScoreInput {
  const withDefaults = { quarter: null, ...input };
  const stmt = getDb().prepare(
    "INSERT INTO score_inputs (year_id, person_id, rule_id, quarter, raw_value) " +
      "VALUES (@year_id, @person_id, @rule_id, @quarter, @raw_value)",
  );
  const info = stmt.run(withDefaults as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<ScoreInput, "id">>): ScoreInput | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE score_inputs SET ${set} WHERE id = @id`).run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM score_inputs WHERE id = ?").run(id);
  return info.changes > 0;
}
