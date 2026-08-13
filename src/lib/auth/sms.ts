import "server-only";

/**
 * SMS provider abstraction.
 *
 * `console` is the default so the whole auth flow is developable without an
 * SMS account. Swap OTP_PROVIDER in .env to go live.
 *
 * A note on choosing a provider for Pakistan: Twilio works but international
 * A2P delivery to PK networks is expensive and sometimes slow. Local
 * aggregators (Telenor Bulk SMS, Jazz, Branded SMS Pakistan) are cheaper and
 * more reliable domestically, and a masked sender ID needs PTA registration —
 * start that paperwork early, it is not fast.
 */

export interface SmsResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const provider = process.env.OTP_PROVIDER ?? "console";

  switch (provider) {
    case "twilio":
      return sendViaTwilio(to, body);
    case "console":
    default:
      console.log(`\n[SMS → ${to}]\n${body}\n`);
      return { ok: true, providerId: "console" };
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio is not configured" };
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );

  if (!res.ok) {
    // Never log the message body on failure — it contains the OTP.
    console.error(`SMS send failed for ${to}: ${res.status}`);
    return { ok: false, error: `Provider returned ${res.status}` };
  }

  const json = (await res.json()) as { sid?: string };
  return { ok: true, providerId: json.sid };
}
