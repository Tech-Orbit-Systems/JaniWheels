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

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login?next=/dashboard/profile");
  const { required } = await searchParams;
  const [account] = await db.select({ name: users.name, email: users.email, phone: users.phone, passwordHash: users.passwordHash, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, sessionUser.id)).limit(1);
  if (!account?.email) redirect("/login?next=/dashboard/profile");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Account settings</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Manage your profile, contact details, photo and password.</p>
      {required === "phone" && (
        <p className="mb-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a Pakistani mobile number before posting an ad. It will remain marked unverified until phone verification is introduced.
        </p>
      )}
      <ProfileForms account={{ name: account.name ?? "JaniWheels user", email: account.email, phone: account.phone ? displayPkPhone(account.phone) : "", hasPassword: Boolean(account.passwordHash), avatarUrl: account.avatarUrl, avatarSrc: account.avatarUrl ? imageDeliveryUrl(account.avatarUrl, 192) : null }} />
    </main>
  );
}
