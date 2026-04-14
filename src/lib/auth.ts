import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

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
  },
  trustedOrigins: [baseURL],
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
});

export type Session = typeof auth.$Infer.Session;
