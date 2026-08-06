// Real credential hashing and session management - node:crypto only, no
// native dependencies (same reasoning as the node:sqlite swap in
// connection.ts: bcrypt/argon2 need a native build step this machine can't
// do). scrypt is a real, slow-by-design KDF - not a toy hash.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as sessions from "../data/sessions.js";
import type { DemoUser } from "../data/demo-users.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, derivedHex] = storedHash.split(":");
  if (!salt || !derivedHex) return false;
  const derived = Buffer.from(derivedHex, "hex");
  const candidate = scryptSync(password, salt, 64);
  return derived.length === candidate.length && timingSafeEqual(derived, candidate);
}

export function createSession(userId: number): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  sessions.create({
    token,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export function resolveSession(token: string | undefined): { userId: number } | null {
  if (!token) return null;
  const session = sessions.findByToken(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    sessions.remove(session.id);
    return null;
  }
  return { userId: session.user_id };
}

export function destroySession(token: string | undefined): void {
  if (!token) return;
  const session = sessions.findByToken(token);
  if (session) sessions.remove(session.id);
}

// Strips password_hash before anything sends a DemoUser back over the wire.
export function toPublicUser(user: DemoUser): Omit<DemoUser, "password_hash"> {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}
