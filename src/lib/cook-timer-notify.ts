import nodemailer from "nodemailer";
import type { PushPayloadV1 } from "@/lib/notifications-types";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      (process.env.TWILIO_FROM_NUMBER?.trim() || process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
  );
}

export function cookNotifyChannelsAvailable(): { smtp: boolean; twilio: boolean } {
  return { smtp: smtpConfigured(), twilio: twilioConfigured() };
}

function timerMessage(payload: PushPayloadV1): string {
  return `Cook timer: ${payload.recipeTitle} — ${payload.stepTitle} (step ${payload.stepIndex + 1}). Open your cook session to continue.`;
}

/** Sends cook-timer email when SMTP_* env is set. */
export async function sendCookTimerEmail(to: string, payload: PushPayloadV1): Promise<boolean> {
  if (!smtpConfigured()) return false;
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT ?? "587") || 587;
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS?.trim() || undefined;
  const from = process.env.SMTP_FROM!.trim();
  const secure = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  const subject = `Focolare: timer — ${payload.recipeTitle}`;
  const text = timerMessage(payload);

  await transporter.sendMail({ from, to, subject, text });
  return true;
}

/** Sends SMS via Twilio REST when TWILIO_* env is set. */
export async function sendCookTimerSms(toE164: string, payload: PushPayloadV1): Promise<boolean> {
  if (!twilioConfigured()) return false;
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const fromNum = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams();
  body.set("To", toE164);
  if (messagingSid) body.set("MessagingServiceSid", messagingSid);
  else if (fromNum) body.set("From", fromNum);
  else return false;
  body.set("Body", timerMessage(payload).slice(0, 1400));

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return res.ok;
}
