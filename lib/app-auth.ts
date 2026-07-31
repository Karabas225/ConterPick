import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { authSessions, users } from "../db/schema";

export type AppUser = {
  id: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  role: string;
};

export const SESSION_COOKIE = "counterpick_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function runtimeEnv(key: string): string | undefined {
  const processEnv = (globalThis as typeof globalThis & { process?: { env?: Record<string, string> } }).process?.env;
  return processEnv?.[key];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(bytes = 32) {
  const output = new Uint8Array(bytes);
  crypto.getRandomValues(output);
  return bytesToBase64(output).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function digest(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(buffer));
}

export async function hashPassword(password: string, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(salt), iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `${salt}.${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(".");
  if (!salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return actual === `${salt}.${expected}`;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? `+${digits.slice(1).replace(/\D/g, "")}` : digits.replace(/\D/g, "");
}

export function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function isPhone(value: string) { return /^\+?[1-9]\d{7,14}$/.test(value); }

function userFromRow(row: typeof users.$inferSelect): AppUser {
  return { id: row.id, email: row.email ?? null, phone: row.phone ?? null, displayName: row.displayName, role: row.role };
}

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

export async function getCurrentUser(request: Request): Promise<AppUser | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const db = await getDb();
  const rows = await db.select({ user: users }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!rows[0]?.user) return null;
  const user = userFromRow(rows[0].user);
  if (user.email && configuredAdminEmails().includes(normalizeEmail(user.email))) user.role = "admin";
  return user;
}

export function configuredAdminEmails() {
  return (runtimeEnv("COUNTERPICK_ADMIN_EMAILS") ?? "").split(",").map((email) => normalizeEmail(email)).filter(Boolean);
}

export async function isAdminRequest(request: Request): Promise<{ user: AppUser | null; isAdmin: boolean }> {
  let user: AppUser | null = null;
  try { user = await getCurrentUser(request); } catch { /* local preview without D1 */ }
  const headerEmail = normalizeEmail(request.headers.get("oai-authenticated-user-email") ?? "");
  const isAdmin = user?.role === "admin" || (!!headerEmail && configuredAdminEmails().includes(headerEmail));
  return { user, isAdmin };
}

export async function createSession(userId: string) {
  const token = randomToken();
  const db = await getDb();
  await db.insert(authSessions).values({ tokenHash: await digest(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

export function setSessionCookie(response: Response, request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

export function clearSessionCookie(response: Response) {
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export async function deleteSession(request: Request) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return;
  const db = await getDb();
  await db.delete(authSessions).where(eq(authSessions.tokenHash, await digest(token)));
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
