import "server-only";

import { captureAcceptanceEmailLink } from "./acceptance-sink";

interface VerificationEmail {
  to: string;
  name: string | null;
  verificationUrl: string;
  idempotencyKey: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[char] ?? char,
  );
}

export async function sendAccountVerificationEmail(
  message: VerificationEmail,
): Promise<void> {
  if (await captureAcceptanceEmailLink("verification", message.to, message.verificationUrl)) return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[JaniWheels email verification] ${message.to}: ${message.verificationUrl}`,
      );
      return;
    }
    throw new Error("Account verification email is not configured.");
  }

  const greeting = message.name ? `Hi ${escapeHtml(message.name)},` : "Hello,";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: "Verify your JaniWheels email",
      text: `Verify your JaniWheels email using this link (valid for 24 hours): ${message.verificationUrl}`,
      html: `<p>${greeting}</p><p>Verify your email to activate your JaniWheels account. This link expires in 24 hours.</p><p><a href="${escapeHtml(message.verificationUrl)}" style="display:inline-block;padding:12px 18px;background:#f7b500;color:#151515;text-decoration:none;border-radius:8px;font-weight:700">Verify email</a></p><p>If you did not create this account, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    console.error(`Account verification email failed: ${response.status}`);
    throw new Error("Account verification email could not be sent.");
  }
}
