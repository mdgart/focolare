# Focolare on iOS and Android

The native shell loads the deployed site in a WebView (`server.url` mode). It is
not a rewrite: the same Next.js app serves both, and day-to-day features ship by
deploying the web app with **no app-store release**.

The reason it exists is the timer. A cook sets a 12-minute prove and puts the
phone face-down; the web app can only ring it via a per-minute server cron plus a
registered push subscription, and on iOS only after a home-screen install. A
native shell lets the OS own the alarm, so it fires with no server, no cron, and
no network.

## Phase 0 — prove the bridge (you must run this)

Everything rests on one assumption: **Capacitor injects its native bridge into a
page served from the internet**, not only into files bundled in the binary. If it
doesn't, every native capability is unreachable from the app and the approach has
to change before anything else is built.

The check is a page: **`/native-check`**.

| Where you open it | Expected |
|---|---|
| Any desktop or mobile browser | `web` — the negative control, already verified |
| Inside the shell, on a device | **`ios`** or **`android`** |

`ios`/`android` → Phase 0 passes, build Phase 1.
`web` **inside the shell** → stop. The plan needs rethinking, not more code.

### What you need installed

Nothing on this machine has a native toolchain yet, so before the gate:

```bash
xcode-select --install && sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

- **iOS** — full Xcode from the App Store, then the `xcode-select` line above
  (Command Line Tools alone are not enough). Capacitor 8 uses Swift Package
  Manager, so **CocoaPods is not required**.
- **Android** — Android Studio, which brings its own JDK and SDK.

### Running it

```bash
npx cap sync && npx cap open ios
```

Then Run in Xcode (simulator is fine for this gate — the bridge behaves the same;
a real device only matters from Phase 1, for alarms) and navigate to
`/native-check`. Repeat with `npx cap open android`.

To point the shell at a local dev server instead of production, set the origin
before syncing — it is baked into the native project at sync time, not read at
runtime:

```bash
NATIVE_SERVER_URL=http://192.168.1.x:3000 npx cap sync
```

Use the LAN address, not `localhost`: on a device `localhost` is the phone.

## What Phase 0 built

| Piece | Why |
|---|---|
| `capacitor.config.ts` | `server.url` + `errorPath`, navigation limited to our own hosts |
| `native/www/offline.html` | Shown when the origin is unreachable; Phase 3 makes it a cook screen |
| `src/lib/native.ts` | `getPlatform()`, `useIsNative()` — the Phase 2 lever for hiding web-only chrome |
| `/api/native/min-version` | The version handshake, shipped now on purpose (see below) |
| `/native-check` | The gate, made visible |

### Why the version handshake ships before it is needed

`server.url` decouples the web app from the shell permanently. The site updates
the moment it deploys; a shell on someone's phone is whatever they last
installed. Without a handshake there is no way to tell an old shell it must
update — and **the first build shipped is the one that can never be told**. It
has to be in the binary from release one or it is useless forever.

Bump `MIN_BUILD` only for a change a shell genuinely cannot survive, never for a
web-only change: those reach every shell on the next page load, which is the
whole point.

## Notes for later phases

- **`webContentsDebuggingEnabled` is opt-in** via `NATIVE_DEBUG=1`. The obvious
  `NODE_ENV !== "production"` test reads *true* at sync time on a developer
  machine and would quietly ship a world-inspectable WebView to the store.
- **Sign-in is not fragile across www/apex.** `trustedOriginsFor()` in
  `src/lib/auth.ts` already trusts the sibling of whatever `BETTER_AUTH_URL`
  gives it, so both spellings work. `server.url` is pinned to `www` only because
  the apex answers 308 and that costs a redirect on every cold launch. What does
  matter is that the shell and auth point at the same *site* — a preview
  deployment with production auth means no session at all.
- **Sessions expire after 7 days.** `src/lib/auth.ts` sets no session options, so
  Better Auth's default applies. Being logged out weekly is tolerable on the web
  and hostile in an installed app — Phase 1 should raise `expiresIn` to ~90 days.
  That is a real security trade and should be a decision, not a side effect.
- **`public/sw.js` is unchanged and stays that way** — push-only, browsers only.
  No service-worker fetch handler: on iOS it needs App-Bound Domains, it sits in
  the path of every native call, and caching RSC payloads for a per-user route
  risks serving one cook's session to another.
