"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { normalizePkPhone } from "@/lib/format";
import { issueEmailVerification } from "./email-verification";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { allowAuthAttempt, AUTH_LIMITS, clearRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath } from "./return-path";
import { logSafeError } from "@/lib/operations/safe-error";

export type AuthMode = "sign_in" | "register";

export interface AuthState {
  mode: AuthMode;
  error?: string;
  fieldErrors?: Record<string, string>;
  next?: string;
  registeredEmail?: string;
}

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Password is too long.");

const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your email address or mobile number.")
    .max(254, "Email address or mobile number is too long."),
  password: z.string().min(1, "Enter your password.").max(128, "Password is too long."),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Keep your name under 100 characters."),
  email: z.string().trim().email("Enter a valid email address.").max(254, "Email address is too long."),
  password: passwordSchema,
});

const dummyHash = hashPassword("not-a-real-account-password");

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent") ?? undefined,
    ip:
      h.get("cf-connecting-ip") ??
      h.get("x-real-ip") ??
      h.get("x-forwarded-for")?.split(",")[0].trim() ??
      undefined,
  };
}

function safeNext(value: FormDataEntryValue | null): string {
  return safeReturnPath(typeof value === "string" ? value : null);
}

function issues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    result[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return result;
}

export async function authenticateAction(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const mode: AuthMode =
    formData.get("mode") === "register" ? "register" : "sign_in";
  const next = safeNext(formData.get("next"));

  if (mode === "register") {
    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return {
        mode,
        next,
        error: "Please fix the highlighted fields.",
        fieldErrors: issues(parsed.error),
      };
    }

    const email = parsed.data.email.toLowerCase();
    if (!await allowAuthAttempt("register", email, await headers(), AUTH_LIMITS.register)) {
      return { mode, next, error: "Too many attempts. Please try again later." };
    }
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return {
        mode,
        next,
        error: "An account already exists with this email address.",
      };
    }

    try {
      const [created] = await db
        .insert(users)
        .values({
          name: parsed.data.name,
          email,
          phone: null,
          passwordHash: await hashPassword(parsed.data.password),
        })
        .returning({ id: users.id });
      const meta = await requestMeta();
      try {
        await issueEmailVerification({
          userId: created.id,
          email,
          name: parsed.data.name,
          requestedIp: meta.ip,
          next,
        });
      } catch (error) {
        logSafeError("auth.registration_delivery_failed", error);
        return {
          mode,
          next,
          error:
            "Your account was created, but the verification email could not be sent. Request a new verification link.",
        };
      }
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "23505") {
        return {
          mode,
          next,
          error: "An account already exists with this email address.",
        };
      }
      throw error;
    }

    return { mode, next, registeredEmail: email };
  }

  const parsed = signInSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      mode,
      next,
      error: "Please fix the highlighted fields.",
      fieldErrors: issues(parsed.error),
    };
  }

  const asEmail = parsed.data.identifier.includes("@");
  const email = asEmail ? parsed.data.identifier.toLowerCase() : null;
  const phone = asEmail ? null : normalizePkPhone(parsed.data.identifier);
  const identity = email ?? phone ?? parsed.data.identifier.toLowerCase();
  if (!await allowAuthAttempt("sign-in", identity, await headers(), AUTH_LIMITS.signIn)) {
    return { mode, next, error: "Too many attempts. Please try again in 15 minutes." };
  }
  const [account] = email || phone
    ? await db
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
          emailVerifiedAt: users.emailVerifiedAt,
          isBanned: users.isBanned,
          closedAt: users.closedAt,
          anonymizedAt: users.anonymizedAt,
        })
        .from(users)
        .where(email ? eq(users.email, email) : eq(users.phone, phone!))
        .limit(1)
    : [];

  const valid = await verifyPassword(
    parsed.data.password,
    account?.passwordHash ?? (await dummyHash),
  );
  if (!account || !valid || account.isBanned || account.anonymizedAt || (account.closedAt && account.closedAt.getTime() + 30 * 86400_000 <= Date.now())) {
    return { mode, next, error: "Incorrect email, mobile number or password." };
  }
  if (asEmail && !account.emailVerifiedAt) {
    return {
      mode,
      next,
      error: "Verify your email before signing in. You can request a new verification link below.",
    };
  }

  await clearRateLimit("sign-in", `identity:${identity}`, AUTH_LIMITS.signIn.windowMs);
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, account.id));
  await createSession(account.id, await requestMeta());
  redirect(account.closedAt ? "/account/restore" : next);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
