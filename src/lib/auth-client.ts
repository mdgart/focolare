import { createAuthClient } from "better-auth/react";

/**
 * No `baseURL` on purpose.
 *
 * The client then posts to the origin the page is actually served from, so auth
 * follows the user whether they arrived on the apex domain or www, and can never
 * request http:// from an https:// page. That mixed-content case is blocked by
 * the browser before the request is sent, which presents as a sign-in or sign-up
 * button hanging on "…" forever rather than as a visible error.
 *
 * Auth calls only run in client components, so the current origin is always known.
 */
export const authClient = createAuthClient();
