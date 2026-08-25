import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { displayPkPhone } from "@/lib/format";
import { imageDeliveryUrl } from "@/lib/images/url";
import { ProfileForms } from "./ProfileForms";

export const metadata: Metadata = { title: "Account settings | JaniWheels", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?next=/dashboard/profile");
  const [account] = await db.select({ name: users.name, email: users.email, phone: users.phone, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
  if (!account?.email) redirect("/login?next=/dashboard/profile");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Account settings</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Manage your profile, contact details, photo and password.</p>
      <ProfileForms account={{ name: account.name ?? "JaniWheels user", email: account.email, phone: displayPkPhone(account.phone), avatarUrl: account.avatarUrl, avatarSrc: account.avatarUrl ? imageDeliveryUrl(account.avatarUrl, 192) : null }} />
    </main>
  );
}
