"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import {
  changePasswordAction,
  removeAvatarAction,
  updateAvatarAction,
  updateProfileAction,
  type AccountFormState,
} from "@/lib/account/actions";

const input = "mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900";

export function ProfileForms({ account }: { account: { name: string; email: string; phone: string; hasPassword: boolean; avatarUrl: string | null; avatarSrc: string | null } }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <div className="space-y-6">
        <ProfileDetails account={account} />
        {account.hasPassword ? <PasswordForm /> : (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Password</h2>
            <p className="mt-1 text-sm text-slate-500">This account signs in with Google. Use password reset if you also want to create a password.</p>
            <Link href="/forgot-password" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">Create a password</Link>
          </section>
        )}
      </div>
      <AvatarForm account={account} />
    </div>
  );
}

function ProfileDetails({ account }: { account: { name: string; email: string; phone: string; hasPassword: boolean } }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-semibold text-slate-900">Personal details</h2><p className="text-sm text-slate-500">These details are used on your ads and account.</p></div>
      <Field label="Full name" error={state.fieldErrors?.name}><input name="name" required maxLength={100} autoComplete="name" defaultValue={account.name} className={input} /></Field>
      <Field label="Verified email address"><input type="email" readOnly value={account.email} className={`${input} bg-slate-50 text-slate-600`} /></Field>
      <Field label="Mobile number" hint="Optional for browsing; required before posting an ad. SMS verification is not active yet." error={state.fieldErrors?.phone}><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="0300 1234567" defaultValue={account.phone} className={input} /></Field>
      {account.hasPassword && <Field label="Current password" hint="Required only when changing your mobile number." error={state.fieldErrors?.currentPassword}><input name="currentPassword" type="password" maxLength={128} autoComplete="current-password" className={input} /></Field>}
      <Status state={state} />
      <button disabled={pending} className="rounded bg-[#f7b500] px-4 py-2.5 font-bold text-[#151515] hover:bg-[#ffc62b] disabled:opacity-60">{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

function PasswordForm() {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div><h2 className="text-lg font-semibold text-slate-900">Change password</h2><p className="text-sm text-slate-500">Changing it signs out every other device.</p></div>
      <Field label="Current password" error={state.fieldErrors?.currentPassword}><input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className={input} /></Field>
      <Field label="New password" hint="Use at least 10 characters." error={state.fieldErrors?.newPassword}><input name="newPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={input} /></Field>
      <Field label="Confirm new password" error={state.fieldErrors?.confirmPassword}><input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className={input} /></Field>
      <Status state={state} />
      <button disabled={pending} className="rounded bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60">{pending ? "Updating…" : "Change password"}</button>
    </form>
  );
}

function AvatarForm({ account }: { account: { name: string; avatarUrl: string | null; avatarSrc: string | null } }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateAvatarAction, {});
  return (
    <section className="h-fit rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Profile photo</h2>
      <p className="text-sm text-slate-500">Shown on your public seller profile. JPEG, PNG, WebP, AVIF or HEIC; maximum 5 MB.</p>
      <div className="my-5 flex items-center gap-4">
        <div className="relative size-24 overflow-hidden rounded-full bg-slate-100">
          {account.avatarSrc ? <Image src={account.avatarSrc} alt={`${account.name} profile`} fill sizes="96px" className="object-cover" /> : <span className="flex size-full items-center justify-center text-3xl font-bold text-slate-400">{account.name.charAt(0).toUpperCase()}</span>}
        </div>
        {account.avatarUrl && <form action={removeAvatarAction}><button className="text-sm font-medium text-red-700 hover:underline">Remove photo</button></form>}
      </div>
      <form action={action} className="space-y-3">
        <input name="avatar" type="file" required accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium" />
        <Status state={state} />
        <button disabled={pending} className="rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60">{pending ? "Uploading…" : "Upload photo"}</button>
      </form>
    </section>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-slate-700">{label}</label>{children}{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</div>;
}

function Status({ state }: { state: AccountFormState }) {
  if (state.error) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>;
  if (state.success) return <p role="status" className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</p>;
  return null;
}
