import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, safeEqual } from "@/lib/auth/session";
import {
  exchangeGoogleCode,
  GoogleAuthError,
  resolveGoogleAccount,
} from "@/lib/auth/google";

export const runtime = "nodejs";

function safeNext(value?: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function loginError(code: string): never {
  redirect(`/login?google=${encodeURIComponent(code)}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const expectedState = jar.get("jw_google_state")?.value;
  const nonce = jar.get("jw_google_nonce")?.value;
  const verifier = jar.get("jw_google_verifier")?.value;
  const next = safeNext(jar.get("jw_google_next")?.value);
  for (const name of [
    "jw_google_state",
    "jw_google_nonce",
    "jw_google_verifier",
    "jw_google_next",
  ]) {
    jar.delete(name);
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (url.searchParams.has("error")) loginError("cancelled");
  if (
    !state ||
    !expectedState ||
    !nonce ||
    !verifier ||
    !code ||
    !safeEqual(state, expectedState)
  ) {
    loginError("invalid_request");
  }

  try {
    const claims = await exchangeGoogleCode({ code, codeVerifier: verifier, nonce });
    const userId = await resolveGoogleAccount(claims);
    const h = await headers();
    await createSession(userId, {
      userAgent: h.get("user-agent") ?? undefined,
      ip:
        h.get("cf-connecting-ip") ??
        h.get("x-real-ip") ??
        h.get("x-forwarded-for")?.split(",")[0].trim() ??
        undefined,
    });
  } catch (error) {
    if (error instanceof GoogleAuthError) loginError(error.code);
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code === "23505") loginError("account_exists");
    throw error;
  }

  redirect(next);
}
