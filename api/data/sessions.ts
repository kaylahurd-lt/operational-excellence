// GENERATED from db/schema.sql `sessions`. Backs the login cookie - see
// api/domain/auth.ts. No update() - a session is either valid or removed.
import { getDb, type Bindable } from "../connection.js";

export interface Session {
  id: number;
  token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}

export function findByToken(token: string): Session | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE token = ?").get(token) as unknown as
    | Session
    | undefined;
}

export function create(input: Omit<Session, "id">): Session {
  const stmt = getDb().prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (@token, @user_id, @created_at, @expires_at)",
  );
  const info = stmt.run(input as unknown as Bindable);
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(Number(info.lastInsertRowid)) as unknown as Session;
}

export function remove(id: number): boolean {
  const info = getDb().prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return info.changes > 0;
}

export function removeAllForUser(userId: number): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
