"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { normalizePkPhone } from "@/lib/format";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export type AuthMode = "sign_in" | "register";

export interface AuthState {
  mode: AuthMode;
  error?: string;
  fieldErrors?: Record<string, string>;
  next?: string;
}

const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Password is too long.");

const signInSchema = z.object({
  phone: z.string().min(10, "Enter your mobile number.").max(20),
  password: z.string().min(1, "Enter your password.").max(128),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  phone: z.string().min(10, "Enter your mobile number.").max(20),
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
  const next = typeof value === "string" ? value : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
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
      phone: formData.get("phone"),
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

    const phone = normalizePkPhone(parsed.data.phone);
    if (!phone) {
      return {
        mode,
        next,
        error: "Please fix the highlighted fields.",
        fieldErrors: { phone: "Enter a valid Pakistani mobile number." },
      };
    }

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.phone, phone), eq(users.email, email)))
      .limit(1);
    if (existing) {
      return {
        mode,
        next,
        error: "An account already exists with this mobile number or email.",
      };
    }

    try {
      const [created] = await db
        .insert(users)
        .values({
          name: parsed.data.name,
          email,
          phone,
          passwordHash: await hashPassword(parsed.data.password),
          lastSeenAt: new Date(),
        })
        .returning({ id: users.id });

      await createSession(created.id, await requestMeta());
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "23505") {
        return {
          mode,
          next,
          error: "An account already exists with this mobile number or email.",
        };
      }
      throw error;
    }

    redirect(next);
  }

  const parsed = signInSchema.safeParse({
    phone: formData.get("phone"),
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

  const phone = normalizePkPhone(parsed.data.phone);
  const [account] = phone
    ? await db
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
          isBanned: users.isBanned,
        })
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1)
    : [];

  const valid = await verifyPassword(
    parsed.data.password,
    account?.passwordHash ?? (await dummyHash),
  );
  if (!account || !valid || account.isBanned) {
    return { mode, next, error: "Incorrect mobile number or password." };
  }

  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, account.id));
  await createSession(account.id, await requestMeta());
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
