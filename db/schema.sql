-- GENERATED from the confirmed data model (CLAUDE_CODE_OpEx_Prototype_Spec.md section 5).
-- One CREATE TABLE per confirmed entity. Every table has an integer primary key.
-- SQLite is prototype-only and lives behind the data-access seam (ADR 0003).
--
-- Arrays (e.g. a rule's applicable levels, a demo user's assigned group ids) are
-- stored as JSON-encoded TEXT columns and (de)serialized in the matching
-- api/data/<table>.ts module — SQLite has no native array type.

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competition_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

-- Competition groups and departments are separate entities (spec section 3):
-- some departments are merged into one competition group. Many-to-many.
CREATE TABLE IF NOT EXISTS competition_group_departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_group_id INTEGER NOT NULL REFERENCES competition_groups(id),
  department_id INTEGER NOT NULL REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  title TEXT,
  level TEXT NOT NULL, -- ASSOCIATE | MANAGER | DIRECTOR | VP_AVP
  department_id INTEGER NOT NULL REFERENCES departments(id),
  competition_group_id INTEGER NOT NULL REFERENCES competition_groups(id),
  manager_id INTEGER REFERENCES persons(id),
  active INTEGER NOT NULL DEFAULT 1 -- boolean
);

CREATE TABLE IF NOT EXISTS demo_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- ADMIN | EA | MANAGER
  assigned_competition_group_ids TEXT, -- JSON number[]
  managed_person_ids TEXT -- JSON number[]
);

CREATE TABLE IF NOT EXISTS award_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' -- ACTIVE | AUDIT_LOCKED | ARCHIVED
);

CREATE TABLE IF NOT EXISTS award_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  applies_to_levels TEXT NOT NULL, -- JSON EmployeeLevel[]
  competition_group_ids TEXT, -- JSON number[] | null = applies to all groups
  rate REAL,
  max_points REAL,
  calculation_type TEXT NOT NULL, -- CalculationType
  quarters INTEGER NOT NULL DEFAULT 0, -- boolean
  formula_confirmed INTEGER NOT NULL DEFAULT 1, -- boolean
  description TEXT
);

CREATE TABLE IF NOT EXISTS score_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_id INTEGER NOT NULL REFERENCES award_years(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  rule_id INTEGER NOT NULL REFERENCES award_rules(id),
  quarter INTEGER, -- 1|2|3|4, null when the rule isn't quarterly
  raw_value REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  demo_user_id INTEGER NOT NULL REFERENCES demo_users(id),
  person_id INTEGER NOT NULL REFERENCES persons(id),
  rule_id INTEGER NOT NULL REFERENCES award_rules(id),
  old_raw_value REAL,
  new_raw_value REAL,
  old_calculated_points REAL NOT NULL,
  new_calculated_points REAL NOT NULL
);
