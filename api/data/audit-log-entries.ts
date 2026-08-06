// GENERATED from db/schema.sql `audit_log_entries`. Every score-input edit
// creates one of these (spec section 5/11) — entries are immutable, so this
// module only exposes list/get/create, never update/remove.
import { getDb, type Bindable } from "../connection.js";

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  demo_user_id: number;
  person_id: number;
  rule_id: number;
  old_raw_value: number | null;
  new_raw_value: number | null;
  old_calculated_points: number;
  new_calculated_points: number;
}

export function list(): AuditLogEntry[] {
  return getDb()
    .prepare("SELECT * FROM audit_log_entries ORDER BY id DESC")
    .all() as unknown as AuditLogEntry[];
}

export function listForPerson(person_id: number): AuditLogEntry[] {
  return getDb()
    .prepare("SELECT * FROM audit_log_entries WHERE person_id = ? ORDER BY id DESC")
    .all(person_id) as unknown as AuditLogEntry[];
}

export function get(id: number): AuditLogEntry | undefined {
  return getDb().prepare("SELECT * FROM audit_log_entries WHERE id = ?").get(id) as unknown as
    | AuditLogEntry
    | undefined;
}

export function create(input: Omit<AuditLogEntry, "id">): AuditLogEntry {
  const stmt = getDb().prepare(
    "INSERT INTO audit_log_entries (timestamp, demo_user_id, person_id, rule_id, old_raw_value, new_raw_value, old_calculated_points, new_calculated_points) " +
      "VALUES (@timestamp, @demo_user_id, @person_id, @rule_id, @old_raw_value, @new_raw_value, @old_calculated_points, @new_calculated_points)",
  );
  const info = stmt.run(input as unknown as Bindable);
  return get(Number(info.lastInsertRowid))!;
}
