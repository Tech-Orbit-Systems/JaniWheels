import "server-only";

interface ResetEmail {
  to: string;
  name: string | null;
  resetUrl: string;
  idempotencyKey: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] ?? char);
}

/**
 * Sends through Resend when configured. Local development deliberately logs
 * the link instead, allowing the complete flow to be tested without putting
 * a production email credential on a developer laptop.
 */
export async function sendPasswordResetEmail(message: ResetEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[JaniWheels password reset] ${message.to}: ${message.resetUrl}`);
      return;
    }
    throw new Error("Password reset email is not configured.");
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
      subject: "Reset your JaniWheels password",
      text: `Reset your JaniWheels password using this link (valid for 30 minutes): ${message.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>${greeting}</p><p>Use the button below to reset your JaniWheels password. The link expires in 30 minutes and can be used only once.</p><p><a href="${escapeHtml(message.resetUrl)}" style="display:inline-block;padding:12px 18px;background:#f7b500;color:#151515;text-decoration:none;border-radius:8px;font-weight:700">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    console.error(`Password reset email failed: ${response.status}`);
    throw new Error("Password reset email could not be sent.");
  }
}
