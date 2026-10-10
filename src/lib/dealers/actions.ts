"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import slugify from "slugify";
import { z } from "zod";
import { db } from "@/db";
import { dealers, users } from "@/db/schema/users";
import { cities } from "@/db/schema/geo";
import { moderationLog } from "@/db/schema/trust";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";
import { removeStoredImage, storeImage } from "@/lib/images/storage";
import { ACCOUNT_LIMITS, allowAccountAction } from "@/lib/security/rate-limit";
import { getDealerForUser } from "./queries";

export interface DealerFormState {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const registerSchema = z.object({
  businessName: z.string().trim().min(3, "Business name is too short.").max(120, "Business name is too long."),
  cityId: z.number().int("Choose a city.").positive("Choose a city."),
  address: z.string().trim().max(240, "Address is too long.").optional(),
  landline: z.string().trim().max(30, "Landline is too long.").optional(),
  whatsapp: z.string().trim().max(30, "WhatsApp number is too long.").optional(),
  about: z.string().trim().max(2000, "About section is too long.").optional(),
});

function fieldIssues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    result[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return result;
}

/** Slugs are permanent once a storefront is indexed, so make them unique up front. */
async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base, { lower: true, strict: true }) || "dealer";
  let candidate = root;
  let n = 2;

  for (;;) {
    const [taken] = await db
      .select({ id: dealers.id })
      .from(dealers)
      .where(eq(dealers.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function registerDealerAction(
  _prev: DealerFormState,
  formData: FormData,
): Promise<DealerFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dealers/register");

  const existing = await getDealerForUser(user.id);
  if (existing) redirect("/dashboard/dealer");
  if (!(await allowAccountAction("dealer-registration", user.id, ACCOUNT_LIMITS.dealerRegistration))) {
    return { error: "Too many dealer registration attempts. Try again later." };
  }

  const parsed = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    cityId: Number(formData.get("cityId")),
    address: (formData.get("address") as string) || undefined,
    landline: (formData.get("landline") as string) || undefined,
    whatsapp: (formData.get("whatsapp") as string) || undefined,
    about: (formData.get("about") as string) || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const slug = await uniqueSlug(parsed.data.businessName);
  const whatsapp = parsed.data.whatsapp
    ? normalizePkPhone(parsed.data.whatsapp)
    : null;
  if (parsed.data.whatsapp && !whatsapp) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { whatsapp: "Enter a valid Pakistani mobile number." },
    };
  }

  await db.transaction(async (tx) => {
    await tx.insert(dealers).values({
      userId: user.id,
      businessName: parsed.data.businessName,
      slug,
      cityId: parsed.data.cityId,
      address: parsed.data.address ?? null,
      landline: parsed.data.landline ?? null,
      whatsapp,
      about: parsed.data.about ?? null,
    });

    await tx.update(users).set({ type: "dealer" }).where(eq(users.id, user.id));
  });

  revalidatePath("/dealers");
  redirect("/dashboard/dealer");
}

async function requireDealerOwner() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/dealer/settings");
  const [dealer] = await db
    .select({
      id: dealers.id,
      userId: dealers.userId,
      slug: dealers.slug,
      businessName: dealers.businessName,
      cityId: dealers.cityId,
      address: dealers.address,
      logoUrl: dealers.logoUrl,
      verifiedAt: dealers.verifiedAt,
    })
    .from(dealers)
    .where(eq(dealers.userId, user.id))
    .limit(1);
  if (!dealer) redirect("/dealers/register");
  return dealer;
}

function revalidateDealer(slug: string) {
  revalidatePath("/");
  revalidatePath("/dealers");
  revalidatePath(`/dealers/${slug}`);
  revalidatePath("/dashboard/dealer");
  revalidatePath("/dashboard/dealer/settings");
  revalidatePath("/admin/dealers");
}

export async function updateDealerProfileAction(
  _previous: DealerFormState,
  formData: FormData,
): Promise<DealerFormState> {
  const dealer = await requireDealerOwner();
  if (!(await allowAccountAction("dealer-profile", dealer.userId, ACCOUNT_LIMITS.dealerProfile))) {
    return { error: "Too many dealer profile changes. Try again later." };
  }
  const parsed = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    cityId: Number(formData.get("cityId")),
    address: String(formData.get("address") ?? "") || undefined,
    landline: String(formData.get("landline") ?? "") || undefined,
    whatsapp: String(formData.get("whatsapp") ?? "") || undefined,
    about: String(formData.get("about") ?? "") || undefined,
  });
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldIssues(parsed.error),
    };
  }

  const [city] = await db
    .select({ id: cities.id })
    .from(cities)
    .where(eq(cities.id, parsed.data.cityId))
    .limit(1);
  if (!city) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { cityId: "Choose a valid city." },
    };
  }

  const whatsapp = parsed.data.whatsapp
    ? normalizePkPhone(parsed.data.whatsapp)
    : null;
  if (parsed.data.whatsapp && !whatsapp) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { whatsapp: "Enter a valid Pakistani mobile number." },
    };
  }
  if (
    parsed.data.landline &&
    !/^[0-9+()\-\s]{5,30}$/.test(parsed.data.landline)
  ) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { landline: "Enter a valid landline number." },
    };
  }

  const identityChanged =
    parsed.data.businessName !== dealer.businessName ||
    parsed.data.cityId !== dealer.cityId ||
    (parsed.data.address ?? null) !== dealer.address;
  const resetVerification = Boolean(dealer.verifiedAt && identityChanged);

  await db.transaction(async (tx) => {
    await tx
      .update(dealers)
      .set({
        businessName: parsed.data.businessName,
        cityId: parsed.data.cityId,
        address: parsed.data.address ?? null,
        landline: parsed.data.landline ?? null,
        whatsapp,
        about: parsed.data.about ?? null,
        ...(resetVerification ? { verifiedAt: null } : {}),
      })
      .where(eq(dealers.id, dealer.id));

    if (resetVerification) {
      await tx.insert(moderationLog).values({
        userId: dealer.userId,
        action: "dealer_review_reset",
        reason: "Verified dealer changed identity details and requires review.",
        isAutomated: true,
        metadata: { dealerId: dealer.id, source: "profile_edit" },
      });
    }
  });

  revalidateDealer(dealer.slug);
  return {
    success: resetVerification
      ? "Dealer profile updated. Identity changes were submitted for verification again."
      : "Dealer profile updated.",
  };
}

export async function updateDealerLogoAction(
  _previous: DealerFormState,
  formData: FormData,
): Promise<DealerFormState> {
  const dealer = await requireDealerOwner();
  if (!(await allowAccountAction("dealer-logo", dealer.userId, ACCOUNT_LIMITS.dealerLogo))) {
    return { error: "Too many logo uploads. Try again later." };
  }
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a logo to upload." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Dealer logos must be 5 MB or smaller." };
  }

  const stored = await storeImage(file);
  if (!stored.ok) return { error: stored.error };
  const resetVerification = Boolean(dealer.verifiedAt);
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(dealers)
        .set({
          logoUrl: stored.image.key,
          ...(resetVerification ? { verifiedAt: null } : {}),
        })
        .where(eq(dealers.id, dealer.id));
      if (resetVerification) {
        await tx.insert(moderationLog).values({
          userId: dealer.userId,
          action: "dealer_review_reset",
          reason: "Verified dealer changed its public logo and requires review.",
          isAutomated: true,
          metadata: { dealerId: dealer.id, source: "logo_update" },
        });
      }
    });
  } catch (error) {
    await removeStoredImage(stored.image.key);
    throw error;
  }
  if (dealer.logoUrl) await removeStoredImage(dealer.logoUrl);
  revalidateDealer(dealer.slug);
  return {
    success: resetVerification
      ? "Logo updated and submitted for verification again."
      : "Dealer logo updated.",
  };
}

export async function removeDealerLogoAction(): Promise<void> {
  const dealer = await requireDealerOwner();
  if (!await allowAccountAction("dealer-logo",dealer.userId,ACCOUNT_LIMITS.dealerLogo)) redirect("/dashboard?limited=1");
  const resetVerification = Boolean(dealer.verifiedAt && dealer.logoUrl);
  await db.transaction(async (tx) => {
    await tx
      .update(dealers)
      .set({ logoUrl: null, ...(resetVerification ? { verifiedAt: null } : {}) })
      .where(eq(dealers.id, dealer.id));
    if (resetVerification) {
      await tx.insert(moderationLog).values({
        userId: dealer.userId,
        action: "dealer_review_reset",
        reason: "Verified dealer removed its public logo and requires review.",
        isAutomated: true,
        metadata: { dealerId: dealer.id, source: "logo_remove" },
      });
    }
  });
  if (dealer.logoUrl) await removeStoredImage(dealer.logoUrl);
  revalidateDealer(dealer.slug);
}

async function requireDealerAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/dealers");
  const [account] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!account?.isAdmin) redirect("/");
  return user;
}

export async function setDealerVerificationAction(
  dealerId: number,
  decision: "verify" | "revoke",
  reason?: string,
): Promise<{ ok: boolean; message: string }> {
  const admin = await requireDealerAdmin();
  if (!Number.isSafeInteger(dealerId) || dealerId<1 || !["verify","revoke"].includes(decision) || (reason!==undefined && typeof reason!=="string")) return {ok:false,message:"Invalid dealer verification decision."};
  if (!await allowAccountAction("admin-write",admin.id,ACCOUNT_LIMITS.adminWrite)) return {ok:false,message:"Too many administrative changes. Please wait and try again."};
  const cleanReason = reason?.trim();
  if (decision === "revoke" && (!cleanReason || cleanReason.length < 5)) {
    return {
      ok: false,
      message: "Enter a revocation reason of at least 5 characters.",
    };
  }
  if (cleanReason && cleanReason.length > 500) {
    return { ok: false, message: "The review note is too long." };
  }

  const outcome = await db.transaction(async (tx) => {
    const [dealer] = await tx
      .select({
        id: dealers.id,
        userId: dealers.userId,
        slug: dealers.slug,
        businessName: dealers.businessName,
        verifiedAt: dealers.verifiedAt,
      })
      .from(dealers)
      .where(eq(dealers.id, dealerId))
      .for("update").limit(1);
    if (!dealer) return { ok: false, message: "Dealer not found.", slug: null };
    if (decision === "verify" && dealer.verifiedAt) {
      return { ok: false, message: "This dealer is already verified.", slug: dealer.slug };
    }
    if (decision === "revoke" && !dealer.verifiedAt) {
      return { ok: false, message: "This dealer is not currently verified.", slug: dealer.slug };
    }

    const now = new Date();
    await tx
      .update(dealers)
      .set({ verifiedAt: decision === "verify" ? now : null })
      .where(eq(dealers.id, dealer.id));
    await tx.insert(moderationLog).values({
      userId: dealer.userId,
      moderatorId: admin.id,
      action: decision === "verify" ? "dealer_verify" : "dealer_revoke",
      reason: cleanReason || (decision === "verify" ? "Dealer identity approved." : null),
      isAutomated: false,
      metadata: {
        dealerId: dealer.id,
        businessName: dealer.businessName,
      },
    });
    return {
      ok: true,
      message:
        decision === "verify"
          ? "Dealer verified and badge activated."
          : "Verification revoked and badge removed.",
      slug: dealer.slug,
    };
  });

  if (outcome.slug) revalidateDealer(outcome.slug);
  return { ok: outcome.ok, message: outcome.message };
}
