"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { sqlClient } from "@/db";
import { createHold, reviewHold, RetentionError, type HoldResource } from "./core";
import { ACCOUNT_LIMITS, allowAccountAction } from "@/lib/security/rate-limit";

export async function createRetentionHoldAction(_state: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Administrator access required." };
  if (!await allowAccountAction("admin-write",user.id,ACCOUNT_LIMITS.adminWrite)) return {error:"Too many administrative changes. Please wait and try again."};
  try { await createHold(sqlClient, String(form.get("resource")) as HoldResource, Number(form.get("resourceId")), String(form.get("reason") ?? ""), String(form.get("responsible") ?? ""), user.id); }
  catch (error) { if (error instanceof RetentionError) return { error: error.message }; throw error; }
  revalidatePath("/admin/retention");
  return { success: "Retention hold created." };
}

export async function reviewRetentionHoldAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new RetentionError("Administrator access required.");
  if (!await allowAccountAction("admin-write",user.id,ACCOUNT_LIMITS.adminWrite)) redirect("/dashboard?limited=1");
  await reviewHold(sqlClient, Number(form.get("holdId")), user.id, form.get("release") === "yes");
  revalidatePath("/admin/retention");
}
