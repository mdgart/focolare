import nodemailer from "nodemailer";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

/** Shared SMTP transport, used by cook-timer alerts and account emails alike. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!smtpConfigured()) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port: Number(process.env.SMTP_PORT ?? "587") || 587,
    secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()
        ? { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS.trim() }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM!.trim(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return true;
}

export function passwordResetEmail(url: string): { subject: string; text: string; html: string } {
  const subject = "Reset your Focolare password";
  const text = [
    "Someone asked to reset the password for your Focolare account.",
    "",
    `Open this link to choose a new one (it expires in 1 hour):`,
    url,
    "",
    "If that wasn't you, you can ignore this email — your password hasn't changed.",
  ].join("\n");

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;background:#faf5ec;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fffdf8;border:1px solid #e9dfce;border-radius:20px;padding:32px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#9a3412;font-weight:600">Focolare</p>
      <h1 style="margin:0 0 16px;font-size:24px;color:#262019">Reset your password</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#5d5347">
        Someone asked to reset the password for your Focolare account. Choose a new one with the button below — the link expires in an hour.
      </p>
      <p style="margin:0 0 24px">
        <a href="${url}" style="display:inline-block;background:#9a3412;color:#fff8f0;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:600">Choose a new password</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#7a6e5f">
        If that wasn't you, ignore this email — your password hasn't changed.
      </p>
    </div>
  </div>`;

  return { subject, text, html };
}
