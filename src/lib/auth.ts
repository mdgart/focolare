import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { passwordResetEmail, sendMail, smtpConfigured } from "@/lib/mailer";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Email/password today; WebAuthn passkeys can be added via Better Auth plugins when you enable them. */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      const mail = passwordResetEmail(url);
      if (!smtpConfigured()) {
        // Without SMTP the flow would silently strand people, so surface the link
        // in the server log for local development.
        console.warn(
          `[auth] SMTP not configured — password reset link for ${user.email}:\n${url}`,
        );
        return;
      }
      try {
        await sendMail({ to: user.email, subject: mail.subject, text: mail.text, html: mail.html });
      } catch (e) {
        console.error("[auth] failed to send password reset email:", e);
        throw e;
      }
    },
  },
  trustedOrigins: [baseURL],
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
});

export type Session = typeof auth.$Infer.Session;
