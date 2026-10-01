"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema/users";
import { normalizePkPhone } from "@/lib/format";
import { removeStoredImage, storeImage } from "@/lib/images/storage";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, getCurrentUser } from "@/lib/auth/session";

export interface AccountFormState {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(100, "Name is too long."),
  phone: z.string().trim().max(20, "Phone number is too long."),
  currentPassword: z.string().max(128, "Password is too long.").optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128, "Password is too long."),
  newPassword: z.string().min(10, "Use at least 10 characters.").max(128, "Password is too long."),
  confirmPassword: z.string().max(128, "Password is too long."),
});

function fieldIssues(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) result[String(issue.path[0] ?? "form")] ??= issue.message;
  return result;
}

async function requireAccount() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?next=/dashboard/profile");
  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      passwordHash: users.passwordHash,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  if (!account) redirect("/login?next=/dashboard/profile");
  return account;
}

export async function updateProfileAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const account = await requireAccount();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    currentPassword: String(formData.get("currentPassword") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldIssues(parsed.error) };

  const phone = parsed.data.phone ? normalizePkPhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: "Please fix the highlighted fields.", fieldErrors: { phone: "Enter a valid Pakistani mobile number." } };
  const contactChanged = phone !== account.phone;

  if (contactChanged && account.passwordHash) {
    if (!parsed.data.currentPassword || !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
      return { error: "Confirm your current password to change your mobile number.", fieldErrors: { currentPassword: "Current password is incorrect." } };
    }
  }

  const [duplicate] = phone
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(and(ne(users.id, account.id), eq(users.phone, phone)))
        .limit(1)
    : [];
  if (duplicate) {
    return { error: "That mobile number is already linked to another account." };
  }

  try {
    await db.update(users).set({ name: parsed.data.name, phone, updatedAt: new Date() }).where(eq(users.id, account.id));
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return { error: "That mobile number is already linked to another account." };
    throw error;
  }

  revalidatePath("/dashboard/profile");
  revalidatePath(`/sellers/${account.id}`);
  return { success: "Profile updated." };
}

export async function changePasswordAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const account = await requireAccount();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldIssues(parsed.error) };
  if (parsed.data.newPassword !== parsed.data.confirmPassword) return { error: "Please fix the highlighted fields.", fieldErrors: { confirmPassword: "Passwords do not match." } };
  if (!account.passwordHash || !(await verifyPassword(parsed.data.currentPassword, account.passwordHash))) {
    return { error: "Current password is incorrect.", fieldErrors: { currentPassword: "Current password is incorrect." } };
  }
  if (await verifyPassword(parsed.data.newPassword, account.passwordHash)) {
    return { error: "Choose a password different from your current password.", fieldErrors: { newPassword: "Choose a different password." } };
  }

  const h = await headers();
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, account.id));
    await tx.delete(sessions).where(eq(sessions.userId, account.id));
  });
  await createSession(account.id, {
    userAgent: h.get("user-agent") ?? undefined,
    ip: h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined,
  });
  return { success: "Password changed. Other signed-in devices were logged out." };
}

export async function updateAvatarAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const account = await requireAccount();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (file.size > 5 * 1024 * 1024) return { error: "Profile images must be 5 MB or smaller." };

  const stored = await storeImage(file);
  if (!stored.ok) return { error: stored.error };
  try {
    await db.update(users).set({ avatarUrl: stored.image.key, updatedAt: new Date() }).where(eq(users.id, account.id));
  } catch (error) {
    await removeStoredImage(stored.image.key);
    throw error;
  }
  if (account.avatarUrl) await removeStoredImage(account.avatarUrl);
  revalidatePath("/dashboard/profile");
  revalidatePath(`/sellers/${account.id}`);
  return { success: "Profile photo updated." };
}

export async function removeAvatarAction(): Promise<void> {
  const account = await requireAccount();
  await db.update(users).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(users.id, account.id));
  if (account.avatarUrl) await removeStoredImage(account.avatarUrl);
  revalidatePath("/dashboard/profile");
  revalidatePath(`/sellers/${account.id}`);
}
