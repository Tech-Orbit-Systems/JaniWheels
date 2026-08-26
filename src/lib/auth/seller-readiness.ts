import "server-only";

import { redirect } from "next/navigation";
import type { SessionUser } from "./session";

export function requirePostingPhone(
  user: SessionUser,
): asserts user is SessionUser & { phone: string } {
  if (!user.phone) redirect("/dashboard/profile?required=phone");
}
