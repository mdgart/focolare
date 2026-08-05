import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native shell, which loads the deployed site rather than bundling it.
 *
 * Focolare is server-rendered to its bones — 86 server actions, 20 of 25 pages
 * hitting Postgres at request time, a direct `pg` connection. Bundling the app
 * into the binary would mean rewriting the data layer into an HTTP API and
 * every server-rendered page into client fetching. That is a rewrite, not a
 * port, so the shell points at the real origin (`server.url`) and the WebView
 * loads what Vercel already serves.
 *
 * The trade, stated plainly: day-to-day features ship by deploying the web app
 * with no app-store release, which is a large ongoing saving. The cost is that
 * the WebView isn't the product — the value is the native scheduling layer
 * built alongside it, so a timer rings on a locked phone with no server, no
 * cron, and no network. That is the whole reason this exists.
 *
 * `server.url` is read at `npx cap sync` time and baked into the native
 * projects, so it is a build-time choice, not a runtime one. Point it at a
 * laptop's LAN address to develop against a local dev server, and re-sync.
 */

/**
 * Canonical origin: `focolare.app` answers 308 and `www` serves, so the apex
 * would cost a redirect on every cold launch.
 *
 * `BETTER_AUTH_URL` doesn't have to match exactly — `trustedOriginsFor()` in
 * `src/lib/auth.ts` already trusts the www/apex sibling of whatever it's given,
 * so sign-in survives either spelling. It does have to be the same *site*: a
 * preview deployment here with production auth there means no session at all.
 */
const DEFAULT_SERVER_URL = "https://www.focolare.app";

const serverUrl = process.env.NATIVE_SERVER_URL?.trim() || DEFAULT_SERVER_URL;

/**
 * Where the WebView may navigate in-place. Anything outside this list opens in
 * the system browser instead, which is what you want for an OAuth provider or
 * an outbound recipe link — and what you very much want for a link a stranger
 * put in a recipe description.
 */
const ownHosts = ["focolare.app", "www.focolare.app"];

const config: CapacitorConfig = {
  appId: "app.focolare",
  appName: "Focolare",

  /**
   * Only ever holds the offline lifeboat. In `server.url` mode the WebView
   * loads the remote origin, so nothing here is the app — but Capacitor still
   * requires the directory to exist, and `errorPath` is served from it when
   * the origin can't be reached.
   */
  webDir: "native/www",

  server: {
    url: serverUrl,
    /** Shown when the origin is unreachable — Phase 3 turns this into a cook screen. */
    errorPath: "offline.html",
    allowNavigation: ownHosts,
    /** No plaintext HTTP: cookies carry the session. */
    cleartext: false,
  },

  ios: {
    /** The cook screen is bright and photo-led; a dark WebView backdrop flashes on launch. */
    backgroundColor: "#FBF7F0",
    /** Recipes are read by scrolling; rubber-banding past the end is expected on iOS. */
    scrollEnabled: true,
  },

  android: {
    backgroundColor: "#FBF7F0",
    /**
     * Opt **in**, not out. This is evaluated at `npx cap sync` time, where
     * NODE_ENV is normally unset — so a `!== "production"` test reads true on
     * a developer's machine and quietly bakes a world-inspectable WebView into
     * the build that goes to the store. Requiring NATIVE_DEBUG=1 means the
     * accident is impossible and the debug case is one env var away.
     */
    webContentsDebuggingEnabled: process.env.NATIVE_DEBUG === "1",
  },
};

export default config;
