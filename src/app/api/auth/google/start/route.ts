import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleConfig, GoogleAuthError } from "@/lib/auth/google";
import { clientIp, consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const TEN_MINUTES = 10 * 60;

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  let config;
  try {
    config = googleConfig();
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return NextResponse.redirect(new URL("/login?google=unavailable", process.env.NEXT_PUBLIC_SITE_URL ?? request.url));
    }
    throw error;
  }

  const ip = clientIp(request.headers);
  if (ip && !await consumeRateLimit({
    scope: "google-auth-start", subject: `ip:${ip}`,
    max: 60, windowMs: 60 * 60_000,
  })) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, {
      status: 429, headers: { "Retry-After": "3600" },
    });
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TEN_MINUTES,
  };
  jar.set("jw_google_state", state, options);
  jar.set("jw_google_nonce", nonce, options);
  jar.set("jw_google_verifier", verifier, options);
  jar.set("jw_google_next", next, options);

  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(authorizationUrl);
}
