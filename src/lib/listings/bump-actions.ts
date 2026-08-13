"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { consumeBump } from "@/lib/payments/orders";

export async function bumpListingAction(
  listingId: number,
): Promise<{ ok: boolean; remaining?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const result = await consumeBump(listingId, user.id);

  if (result.ok) {
    revalidatePath("/used-cars");
    revalidatePath("/dashboard");
  }

  return result;
}
