// GENERATED from db/schema.sql `award_rules`. `applies_to_levels` and
// `competition_group_ids` are arrays stored as JSON TEXT and (de)serialized
// here at the seam boundary, same pattern as api/data/demo-users.ts.
import { getDb, type Bindable } from "../connection.js";
import type { EmployeeLevel } from "./persons.js";

export type CalculationType =
  | "FIXED_PER_OCCURRENCE"
  | "CAPPED_PER_OCCURRENCE"
  | "QUARTERLY_SUM_TIMES_RATE"
  | "BADGES_PER_POINT"
  | "SCORE_INPUT"
  | "MAPPED_SCORE_TBD"
  | "UNKNOWN";

export interface AwardRule {
  id: number;
  name: string;
  applies_to_levels: EmployeeLevel[];
  competition_group_ids: number[] | null;
  rate: number | null;
  max_points: number | null;
  calculation_type: CalculationType;
  quarters: number; // boolean
  formula_confirmed: number; // boolean
  description: string | null;
}

interface AwardRuleRow {
  id: number;
  name: string;
  applies_to_levels: string;
  competition_group_ids: string | null;
  rate: number | null;
  max_points: number | null;
  calculation_type: CalculationType;
  quarters: number;
  formula_confirmed: number;
  description: string | null;
}

function fromRow(row: AwardRuleRow): AwardRule {
  return {
    ...row,
    applies_to_levels: JSON.parse(row.applies_to_levels),
    competition_group_ids: row.competition_group_ids ? JSON.parse(row.competition_group_ids) : null,
  };
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "applies_to_levels", "calculation_type"],
  properties: {
    name: { type: "string", minLength: 1 },
    applies_to_levels: {
      type: "array",
      items: { type: "string", enum: ["ASSOCIATE", "MANAGER", "DIRECTOR", "VP_AVP"] },
      minItems: 1,
    },
    competition_group_ids: { type: ["array", "null"], items: { type: "integer" } },
    rate: { type: ["number", "null"] },
    max_points: { type: ["number", "null"] },
    calculation_type: {
      type: "string",
      enum: [
        "FIXED_PER_OCCURRENCE",
        "CAPPED_PER_OCCURRENCE",
        "QUARTERLY_SUM_TIMES_RATE",
        "BADGES_PER_POINT",
        "SCORE_INPUT",
        "MAPPED_SCORE_TBD",
        "UNKNOWN",
      ],
    },
    quarters: { type: "integer", enum: [0, 1] },
    formula_confirmed: { type: "integer", enum: [0, 1] },
    description: { type: ["string", "null"] },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createSchema.properties,
} as const;

export type CreateAwardRuleInput = Omit<
  AwardRule,
  "id" | "competition_group_ids" | "rate" | "max_points" | "quarters" | "formula_confirmed" | "description"
> &
  Partial<
    Pick<
      AwardRule,
      "competition_group_ids" | "rate" | "max_points" | "quarters" | "formula_confirmed" | "description"
    >
  >;

export function list(): AwardRule[] {
  const rows = getDb().prepare("SELECT * FROM award_rules").all() as unknown as AwardRuleRow[];
  return rows.map(fromRow);
}

export function get(id: number): AwardRule | undefined {
  const row = getDb().prepare("SELECT * FROM award_rules WHERE id = ?").get(id) as unknown as
    | AwardRuleRow
    | undefined;
  return row ? fromRow(row) : undefined;
}

export function create(input: CreateAwardRuleInput): AwardRule {
  const stmt = getDb().prepare(
    "INSERT INTO award_rules (name, applies_to_levels, competition_group_ids, rate, max_points, calculation_type, quarters, formula_confirmed, description) " +
      "VALUES (@name, @applies_to_levels, @competition_group_ids, @rate, @max_points, @calculation_type, @quarters, @formula_confirmed, @description)",
  );
  const info = stmt.run({
    name: input.name,
    applies_to_levels: JSON.stringify(input.applies_to_levels),
    competition_group_ids: input.competition_group_ids ? JSON.stringify(input.competition_group_ids) : null,
    rate: input.rate ?? null,
    max_points: input.max_points ?? null,
    calculation_type: input.calculation_type,
    quarters: input.quarters ?? 0,
    formula_confirmed: input.formula_confirmed ?? 1,
    description: input.description ?? null,
  } as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<AwardRule, "id">>): AwardRule | undefined {
  const patch: Record<string, unknown> = { ...input };
  if ("applies_to_levels" in patch) patch.applies_to_levels = JSON.stringify(patch.applies_to_levels);
  if ("competition_group_ids" in patch) {
    patch.competition_group_ids = patch.competition_group_ids
      ? JSON.stringify(patch.competition_group_ids)
      : null;
  }
  const keys = Object.keys(patch);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb()
    .prepare(`UPDATE award_rules SET ${set} WHERE id = @id`)
    .run({ ...patch, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM award_rules WHERE id = ?").run(id);
  return info.changes > 0;
}
