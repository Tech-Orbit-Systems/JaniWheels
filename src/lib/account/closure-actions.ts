"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sqlClient } from "@/db";
import { createSession, destroySession, getCurrentUser, getSessionAccount } from "@/lib/auth/session";
import { closeAccount, restoreAccount, RetentionError } from "@/lib/retention/core";
import { allowAccountAction } from "@/lib/security/rate-limit";

export async function closeAccountAction(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard/profile");
  if (form.get("confirmation") !== "CLOSE") return { error: "Type CLOSE to confirm account closure." };
  if (!await allowAccountAction("closure", user.id, { max: 5, windowMs: 3600_000 })) return { error: "Too many attempts. Try again later." };
  try { await closeAccount(sqlClient, user.id); }
  catch (error) { if (error instanceof RetentionError) return { error: error.message }; throw error; }
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/account/closed");
}

export async function restoreAccountAction(): Promise<{ error?: string }> {
  const user = await getSessionAccount();
  if (!user?.closedAt || !user.recoveryOnly) return { error: "Sign in to the closed account before restoring it." };
  if (!await allowAccountAction("restore", user.id, { max: 5, windowMs: 3600_000 })) return { error: "Too many attempts. Try again later." };
  try { await restoreAccount(sqlClient, user.id); }
  catch (error) { if (error instanceof RetentionError) return { error: error.message }; throw error; }
  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard/profile?restored=1");
}
