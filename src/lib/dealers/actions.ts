"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import slugify from "slugify";
import { z } from "zod";
import { db } from "@/db";
import { dealers, users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { getDealerForUser } from "./queries";

export interface DealerFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const registerSchema = z.object({
  businessName: z.string().trim().min(3, "Business name is too short.").max(120),
  cityId: z.number().int().positive("Choose a city."),
  address: z.string().trim().max(240).optional(),
  landline: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  about: z.string().trim().max(2000).optional(),
});

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

  await db.transaction(async (tx) => {
    await tx.insert(dealers).values({
      userId: user.id,
      businessName: parsed.data.businessName,
      slug,
      cityId: parsed.data.cityId,
      address: parsed.data.address ?? null,
      landline: parsed.data.landline ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      about: parsed.data.about ?? null,
    });

    await tx.update(users).set({ type: "dealer" }).where(eq(users.id, user.id));
  });

  revalidatePath("/dealers");
  redirect("/dashboard/dealer");
}
