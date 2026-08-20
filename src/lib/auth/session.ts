import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users } from "@/db/schema/users";

/**
 * Session handling.
 *
 * The cookie carries a random 32-byte token. The database stores only its
 * SHA-256 hash, so a leaked database dump does not hand over live sessions.
 * (Unlike the incumbent, whose session cookie is a base64 Ruby Marshal blob
 * containing the session state itself.)
 *
 * SHA-256 without a work factor is correct here and would be wrong for
 * passwords: the token has 256 bits of entropy, so there is nothing to brute
 * force. Work factors exist to slow down guessing low-entropy human secrets.
 */

const COOKIE_NAME = "jw_session";
const SESSION_DAYS = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: number;
  phone: string;
  name: string | null;
  type: "individual" | "dealer";
  isAdmin: boolean;
}

export async function createSession(
  userId: number,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: meta.userAgent?.slice(0, 500) ?? null,
    ip: meta.ip ?? null,
  });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Request-cached: several server components per render ask "who is this?"
 * and without the cache that is a database round trip each time.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      phone: users.phone,
      name: users.name,
      type: users.type,
      isAdmin: users.isAdmin,
      isBanned: users.isBanned,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row || row.isBanned) return null;

  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    type: row.type,
    isAdmin: row.isAdmin,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE_NAME);
}

/** Constant-time compare for anything secret-adjacent. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
