"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { sqlClient } from "@/db";
import { createHold, reviewHold, RetentionError, type HoldResource } from "./core";

export async function createRetentionHoldAction(_state: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Administrator access required." };
  try { await createHold(sqlClient, String(form.get("resource")) as HoldResource, Number(form.get("resourceId")), String(form.get("reason") ?? ""), String(form.get("responsible") ?? ""), user.id); }
  catch (error) { if (error instanceof RetentionError) return { error: error.message }; throw error; }
  revalidatePath("/admin/retention");
  return { success: "Retention hold created." };
}

export async function reviewRetentionHoldAction(form: FormData) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) throw new RetentionError("Administrator access required.");
  await reviewHold(sqlClient, Number(form.get("holdId")), user.id, form.get("release") === "yes");
  revalidatePath("/admin/retention");
}
