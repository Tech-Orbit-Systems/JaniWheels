"use server";

import { z } from "zod";
import { db } from "@/db";
import { serviceEnquiries } from "@/db/schema/commerce";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizePkPhone } from "@/lib/format";

/**
 * Lead capture for the adjacent services.
 *
 * Pure lead-gen: a bank or insurer pays per qualified enquiry. The
 * marketplace never touches the money, never underwrites, and must never
 * imply it did — hence the disclaimer copy on both pages. Getting that wrong
 * is a regulatory problem, not just a UX one.
 */

const SERVICE_TYPES = [
  "finance",
  "insurance",
  "registration",
  "transfer",
  "import",
] as const;

const schema = z.object({
  type: z.enum(SERVICE_TYPES),
  name: z.string().trim().min(2, "Please give your name.").max(80),
  phone: z
    .string()
    .min(10, "Enter your mobile number, e.g. 0300 1234567.")
    .max(20, "That number is too long."),
  cityId: z.number().int().positive().optional(),
  listingId: z.number().int().positive().optional(),
  amountPkr: z.number().int().positive().optional(),
  tenureMonths: z.number().int().positive().max(120).optional(),
  downPaymentPkr: z.number().int().nonnegative().optional(),
});

export interface EnquiryState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function optionalInt(v: FormDataEntryValue | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

export async function submitEnquiryAction(
  _prev: EnquiryState,
  formData: FormData,
): Promise<EnquiryState> {
  const parsed = schema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    cityId: optionalInt(formData.get("cityId")),
    listingId: optionalInt(formData.get("listingId")),
    amountPkr: optionalInt(formData.get("amountPkr")),
    tenureMonths: optionalInt(formData.get("tenureMonths")),
    downPaymentPkr: optionalInt(formData.get("downPaymentPkr")),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const phone = normalizePkPhone(parsed.data.phone);
  if (!phone) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: { phone: "That doesn't look like a PK mobile number." },
    };
  }

  const user = await getCurrentUser();

  await db.insert(serviceEnquiries).values({
    type: parsed.data.type,
    userId: user?.id ?? null,
    listingId: parsed.data.listingId ?? null,
    name: parsed.data.name,
    phone,
    cityId: parsed.data.cityId ?? null,
    details: {
      amountPkr: parsed.data.amountPkr,
      tenureMonths: parsed.data.tenureMonths,
      downPaymentPkr: parsed.data.downPaymentPkr,
    },
  });

  return { ok: true };
}

// Note: every export from a "use server" module must be an async function.
// The EMI maths lives in ./emi.ts for that reason.
