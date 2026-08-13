"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizePkPhone } from "@/lib/format";
import { requestOtp, verifyOtp } from "./otp";
import { createSession, destroySession } from "./session";

/**
 * Auth server actions.
 *
 * Both actions return a serializable state object rather than throwing, so
 * the form can render errors inline via useActionState without a client-side
 * fetch layer.
 */

export interface AuthState {
  step: "phone" | "code";
  phone?: string;
  error?: string;
  devCode?: string;
  /** Where to send the user after a successful login. */
  next?: string;
}

const phoneSchema = z.string().min(10).max(20);
const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    undefined
  );
}

export async function requestCodeAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const next = (formData.get("next") as string) || "/";
  const raw = phoneSchema.safeParse(formData.get("phone"));

  if (!raw.success) {
    return { step: "phone", error: "Enter your mobile number.", next };
  }

  const phone = normalizePkPhone(raw.data);
  if (!phone) {
    return {
      step: "phone",
      error: "That doesn't look like a Pakistani mobile number.",
      next,
    };
  }

  const result = await requestOtp(phone, await clientIp());
  if (!result.ok) {
    return { step: "phone", error: result.error, next };
  }

  return { step: "code", phone, devCode: result.devCode, next };
}

export async function verifyCodeAction(
  prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const phone = (formData.get("phone") as string) ?? prev.phone;
  const next = (formData.get("next") as string) || prev.next || "/";

  if (!phone) {
    return { step: "phone", error: "Start again — we lost your number.", next };
  }

  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) {
    return { step: "code", phone, error: code.error.issues[0].message, next };
  }

  const result = await verifyOtp(phone, code.data);
  if (!result.ok) {
    return { step: "code", phone, error: result.error, next };
  }

  const h = await headers();
  await createSession(result.userId, {
    userAgent: h.get("user-agent") ?? undefined,
    ip: await clientIp(),
  });

  // Only ever redirect to a same-site path. Taking `next` straight from the
  // form would be an open redirect — a phishing primitive, and a cheap one.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
