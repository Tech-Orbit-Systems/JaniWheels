import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { displayPkPhone } from "@/lib/format";

/**
 * Header account area.
 *
 * Exists because the site previously had no way to sign out at all — the
 * action was written but never wired to anything, so a session lasted 60 days
 * with no user-facing escape. On a shared or family computer that is a real
 * problem, not a cosmetic one.
 *
 * Server component: the sign-out is a plain form posting to a server action,
 * so it works with JavaScript disabled and ships no client JS.
 */
export async function AccountMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium text-zinc-200 hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-zinc-200 hover:bg-white/10 hover:text-white"
      >
        <span className="hidden sm:inline">
          {user.name ?? displayPkPhone(user.phone)}
        </span>
        <span className="sm:hidden">Account</span>
        <span aria-hidden className="text-xs text-zinc-400">
          ▾
        </span>
      </button>

      {/* CSS-only dropdown — focus-within keeps it keyboard reachable. */}
      <div className="invisible absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <p className="border-b border-slate-100 px-3 pb-2 pt-1 text-xs text-slate-500">
          {displayPkPhone(user.phone)}
        </p>

        <Link href="/dashboard" className={item}>
          My ads
        </Link>
        <Link href="/dashboard/saved" className={item}>Saved ads</Link>
        <Link href="/dashboard/saved-searches" className={item}>Saved searches</Link>
        <Link href="/dashboard/profile" className={item}>Account settings</Link>
        {user.type === "dealer" ? (
          <Link href="/dashboard/dealer" className={item}>
            Dealer console
          </Link>
        ) : (
          <Link href="/dealers/register" className={item}>
            Become a dealer
          </Link>
        )}
        {row?.isAdmin && (
          <>
            <Link href="/admin/moderation" className={item}>
              Moderation
            </Link>
            <Link href="/admin/dealers" className={item}>
              Dealer verification
            </Link>
          </>
        )}

        <form action={logoutAction} className="border-t border-slate-100 pt-1">
          <button type="submit" className={`${item} w-full text-left`}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

const item = "block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50";
