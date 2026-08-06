// GENERATED from db/schema.sql `award_years`. See _table.template.ts for the pattern.
import { getDb, type Bindable } from "../connection.js";

export type AwardYearStatus = "ACTIVE" | "AUDIT_LOCKED" | "ARCHIVED";

export interface AwardYear {
  id: number;
  year: number;
  status: AwardYearStatus;
}

export const createSchema = {
  type: "object",
  additionalProperties: false,
  required: ["year"],
  properties: {
    year: { type: "integer", minimum: 2000 },
    status: { type: "string", enum: ["ACTIVE", "AUDIT_LOCKED", "ARCHIVED"] },
  },
} as const;

export const updateSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    year: { type: "integer", minimum: 2000 },
    status: { type: "string", enum: ["ACTIVE", "AUDIT_LOCKED", "ARCHIVED"] },
  },
} as const;

export type CreateAwardYearInput = Omit<AwardYear, "id" | "status"> & Partial<Pick<AwardYear, "status">>;

export function list(): AwardYear[] {
  return getDb().prepare("SELECT * FROM award_years").all() as unknown as AwardYear[];
}

export function get(id: number): AwardYear | undefined {
  return getDb().prepare("SELECT * FROM award_years WHERE id = ?").get(id) as unknown as
    | AwardYear
    | undefined;
}

export function create(input: CreateAwardYearInput): AwardYear {
  const withDefaults = { status: "ACTIVE", ...input };
  const stmt = getDb().prepare(
    "INSERT INTO award_years (year, status) VALUES (@year, @status)",
  );
  const info = stmt.run(withDefaults as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}

export function update(id: number, input: Partial<Omit<AwardYear, "id">>): AwardYear | undefined {
  const keys = Object.keys(input);
  if (keys.length === 0) return get(id);
  const set = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE award_years SET ${set} WHERE id = @id`).run({ ...input, id } as unknown as Bindable);
  return get(id);
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM award_years WHERE id = ?").run(id);
  return info.changes > 0;
}
