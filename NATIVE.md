# Focolare on iOS and Android

The native shell loads the deployed site in a WebView (`server.url` mode). It is
not a rewrite: the same Next.js app serves both, and day-to-day features ship by
deploying the web app with **no app-store release**.

The reason it exists is the timer. A cook sets a 12-minute prove and puts the
phone face-down; the web app can only ring it via a per-minute server cron plus a
registered push subscription, and on iOS only after a home-screen install. A
native shell lets the OS own the alarm, so it fires with no server, no cron, and
no network.

## Phase 0 — passed ✅

Verified on **both** platforms against a production build, 2026-08-05 — Android
emulator (API 36) and iOS simulator (iPhone 17 Pro, iOS 26.5). Read from inside
the WebView, on a page served over the network:

| | Android | iOS |
|---|---|---|
| `getPlatform()` | `android` | `ios` |
| `isNativePlatform()` | true | true |
| native message bridge | `androidBridge` | `webkit.messageHandlers.bridge` |
| version handshake | reachable | reachable |

**Capacitor injects its native bridge into a remote origin, on both engines.**
The `server.url` approach is viable; Phase 1 can proceed.

### Two things the iOS run turned up

**App Transport Security.** iOS blocks cleartext HTTP, so pointing the shell at
a Mac on the LAN needs an exception. `Info.plist` sets `NSAllowsLocalNetworking`
rather than `NSAllowsArbitraryLoads` — it permits RFC1918 and `.local` addresses
only, so local development works while the shipping origin stays HTTPS-only. Do
not swap it for `NSAllowsArbitraryLoads`; App Review asks about that one, and it
would weaken every connection the app makes.

**The header collides with the status bar.** In the shell the WebView fills the
screen including the notch and Dynamic Island, and the site's header has no
safe-area insets — the wordmark runs into the clock and the Sign up button sits
under the island. Harmless on the web, wrong in an installed app. Phase 2 should
add `env(safe-area-inset-*)` padding to the header and any fixed element, which
is the same pass that hides web-only chrome behind `useIsNative()`.

## Phase 1 — cook timers ring on a locked phone ✅

Verified on the Android emulator, 2026-08-06. A timer was scheduled from the
WebView, then the network was cut and the phone put to sleep:

| Condition | Result |
|---|---|
| App backgrounded (`topResumedActivity` = 0) | fired |
| Screen asleep (`mWakefulness=Asleep`) | fired |
| **Airplane mode on** — no server, no cron, no network | fired |
| Burst of three, grouped | one heading badged "3", not three rows |
| Channel | `focolare-timer`, importance 5 |

That is the whole point of the project, demonstrated end to end: the OS holds the
alarm, so it rings with nothing else running.

Verified on iOS too (iPhone 17 Pro, iOS 26.5), with the app **fully terminated**
rather than merely backgrounded — `launchctl` showing zero processes. The OS held
the alarm and delivered it, and the burst grouped under one thread.

**iOS needed two fixes that failed silently**, both found only by reading
`interruption-level:` in the device log:

1. **The entitlement was missing.** Without
   `com.apple.developer.usernotifications.time-sensitive` in
   `ios/App/App/App.entitlements`, iOS reports `timeSensitiveSetting:
   NotSupported` and downgrades the notification.
2. **The option key was wrong.** Capacitor wants `interruptionLevel`, not
   `iosInterruptionLevel`. An unknown key is ignored, not rejected.

Either one alone delivered at `interruption-level: active` — arriving, looking
correct, and waiting politely behind a Focus mode while dinner burned. With both
fixed the log reads `interruption-level: time-sensitive`.

**Still untestable on a simulator: the silent switch.** iOS will not ring a
`timeSensitive` notification on a physically silenced phone, and `critical` needs
an entitlement Apple does not grant cooking apps. A simulator has no such switch,
so this stays theoretical until someone tries a real handset — it is why the
in-page beep stays, and why the UI should say so rather than let a cook find out
with a burnt loaf.

To repeat it: open `/native-check` in the shell, press **Schedule a test alarm**,
then lock the phone. The page also reports whether Android will honour *exact*
alarms — if that says `BATCHED`, timers will fire late and the cause is the
`SCHEDULE_EXACT_ALARM` permission being revoked in Settings.

## ⚠️ Do not develop the shell against `next dev`

This cost an afternoon, so it is the first thing to know.

**`next dev` renders inside the WebView but never hydrates.** Turbopack's dev
runtime does not boot in Android's WebView (Chrome 133): 19 scripts load, none
fail, `__turbopack_context__` stays undefined, and no React fiber is ever
attached. The app looks completely normal and is entirely non-interactive — no
effects, no state, no clicks. Nothing announces this; the page just sits there
showing its server-rendered HTML.

It also produces a **false negative on the gate itself**: the check page reported
`web` while the runtime underneath it said `android`, because the component that
reads the platform never ran.

Against a production build every one of those flips: React hydrates, the bridge
reports `android`, and the page shows what the runtime shows.

So the native workflow always runs a production server:

```bash
npm run native:serve            # next build && next start -p 3001
```

```bash
npm run native:gate && npx cap open android
```

The tradeoff is real — no hot reload, and a rebuild for every web change. That
is the price of the WebView being an honest preview of production.

## The gate (re-run it after any change to the shell)

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

- **iOS** — full Xcode from the Mac App Store (`open "macappstore://apps.apple.com/app/id497799835"`),
  which is a ~7 GB download. `xcode-select --install` is **not** enough — that
  installs the Command Line Tools, which cannot build an app. After it lands:

  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -runFirstLaunch && sudo xcodebuild -license accept
  ```

  Capacitor 8 uses Swift Package Manager, so **CocoaPods is not required**.

- **Android** — `brew install --cask android-studio`, then open it once to let it
  fetch the SDK. Much smaller and quicker than Xcode, and it answers the same
  question, so it is the better first move while Xcode downloads.

### Running it

**"The shell" means the Focolare app itself** — the native wrapper around the
WebView, running on a simulator or a phone. Not a terminal.

It has no address bar, and `/native-check` only exists on this branch, so
pointing the app at production would 404. Instead, aim the shell straight at the
check page on a local **production** server. Two terminals:

```bash
npm run native:serve
```

```bash
npm run native:gate && npx cap open ios
```

Press Run in Xcode. The app opens **directly on the check page** — nothing to
navigate to. Repeat with `npx cap open android`.

A simulator is fine for this gate: the bridge behaves identically. A real device
only matters from Phase 1, where alarms and lock-screen behaviour are the point.

`native:gate` fills in your Mac's LAN address automatically. It must be the LAN
address, never `localhost` — inside the app, `localhost` is the phone. Because
a dev server is plain HTTP, the config also switches on `cleartext` and
whitelists that host; both are derived from the URL, so an `https://` origin
keeps production's rules whatever else is set. Without that, Android shows a
blank white screen and no error that points at the cause.

| Script | Origin the shell loads |
|---|---|
| `npm run native:serve` | (not a sync) builds and serves production on :3001 |
| `npm run native:gate` | your local prod server, opening on `/native-check` |
| `npm run native:local` | your local prod server, home page |
| `npm run native:prod` | `https://www.focolare.app` — the shipping default |

Re-run one of these after changing the origin: it is baked into the native
project at sync time, not read at runtime. **Run `native:prod` before building
anything you intend to ship**, or you will ship a shell pointing at a laptop.

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
