import "server-only";

import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { db } from "@/db";
import { authAccounts, users } from "@/db/schema/users";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const claimsSchema = z.object({
  sub: z.string().min(1, "Google account ID is missing."),
  email: z.string().email("Google account email is invalid."),
  email_verified: z.literal(true),
  name: z.string().trim().min(1, "Google account name is empty.").max(100, "Google account name is too long.").optional(),
  hd: z.string().optional(),
});

const tokenResponseSchema = z.object({
  id_token: z.string().min(1, "Google sign-in token is missing."),
});

export class GoogleAuthError extends Error {
  constructor(
    public readonly code:
      | "configuration"
      | "invalid_token"
      | "account_exists"
      | "account_blocked",
  ) {
    super(code);
  }
}

export function googleConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId || !clientSecret || !origin) {
    throw new GoogleAuthError("configuration");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: new URL("/api/auth/google/callback", origin).toString(),
  };
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<z.infer<typeof claimsSchema>> {
  const config = googleConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new GoogleAuthError("invalid_token");

  const tokenResponse = tokenResponseSchema.safeParse(await response.json());
  if (!tokenResponse.success) throw new GoogleAuthError("invalid_token");

  try {
    const verified = await jwtVerify(tokenResponse.data.id_token, GOOGLE_JWKS, {
      audience: config.clientId,
      issuer: GOOGLE_ISSUERS,
      algorithms: ["RS256"],
    });
    if (verified.payload.nonce !== input.nonce) {
      throw new GoogleAuthError("invalid_token");
    }
    const claims = claimsSchema.safeParse(verified.payload);
    if (!claims.success) throw new GoogleAuthError("invalid_token");
    return claims.data;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    throw new GoogleAuthError("invalid_token");
  }
}

function googleIsAuthoritativeForEmail(email: string, hostedDomain?: string) {
  return email.toLowerCase().endsWith("@gmail.com") || Boolean(hostedDomain);
}

/**
 * Provider subjects are linked first. Email linking is allowed only when
 * Google is authoritative for the address, preventing a third-party Google
 * account from silently taking over an existing password account.
 */
export async function resolveGoogleAccount(
  claims: z.infer<typeof claimsSchema>,
): Promise<number> {
  const email = claims.email.toLowerCase();
  const authoritative = googleIsAuthoritativeForEmail(email, claims.hd);

  return db.transaction(async (tx) => {
    const [linked] = await tx
      .select({
        userId: authAccounts.userId,
        isBanned: users.isBanned,
        closedAt: users.closedAt,
      })
      .from(authAccounts)
      .innerJoin(users, eq(users.id, authAccounts.userId))
      .where(
        and(
          eq(authAccounts.provider, "google"),
          eq(authAccounts.providerSubject, claims.sub),
        ),
      )
      .limit(1);

    if (linked) {
      if (linked.isBanned || (linked.closedAt && linked.closedAt.getTime()+30*86400_000<=Date.now())) throw new GoogleAuthError("account_blocked");
      await tx
        .update(authAccounts)
        .set({ providerEmail: email, updatedAt: new Date() })
        .where(
          and(
            eq(authAccounts.provider, "google"),
            eq(authAccounts.providerSubject, claims.sub),
          ),
        );
      await tx
        .update(users)
        .set({ lastSeenAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, linked.userId));
      return linked.userId;
    }

    const [sameEmail] = await tx
      .select({ id: users.id, isBanned: users.isBanned, closedAt: users.closedAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (sameEmail) {
      if (sameEmail.isBanned || (sameEmail.closedAt && sameEmail.closedAt.getTime()+30*86400_000<=Date.now())) throw new GoogleAuthError("account_blocked");
      if (!authoritative) throw new GoogleAuthError("account_exists");
      await tx.insert(authAccounts).values({
        userId: sameEmail.id,
        provider: "google",
        providerSubject: claims.sub,
        providerEmail: email,
      });
      await tx
        .update(users)
        .set({
          emailVerifiedAt: new Date(),
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, sameEmail.id));
      return sameEmail.id;
    }

    const [created] = await tx
      .insert(users)
      .values({
        name: claims.name ?? email.split("@")[0],
        email,
        emailVerifiedAt: new Date(),
        phone: null,
        passwordHash: null,
        lastSeenAt: new Date(),
      })
      .returning({ id: users.id });
    await tx.insert(authAccounts).values({
      userId: created.id,
      provider: "google",
      providerSubject: claims.sub,
      providerEmail: email,
    });
    return created.id;
  });
}
