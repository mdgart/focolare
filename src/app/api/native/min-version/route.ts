import { NextResponse } from "next/server";

/**
 * The oldest shell this deployment still works with.
 *
 * `server.url` decouples the web app from the native shell permanently: the
 * site updates the moment it deploys, while a shell on someone's phone is
 * whatever version they last installed — possibly for years. Without a
 * handshake there is no way to tell an old shell it must update, and the
 * *first* build shipped is the one that can never be told. That is why this
 * exists in Phase 0, before there is anything to gate: it has to be in the
 * binary from the first release or it is useless forever.
 *
 * The rule is deliberately one-directional. This says "you are too old to
 * work", never "you should upgrade" — a blocking screen is a serious thing to
 * show someone halfway through cooking, and it should only ever appear when
 * the app genuinely cannot function.
 *
 * Phase 1 adds the client half: read this on launch and on resume, compare to
 * the shell's own build number, and show a blocking update screen when below
 * `minBuild`. Until then this endpoint just answers, which is enough to prove
 * the shell can reach it.
 */

/**
 * Bump only for a change the shell genuinely cannot survive — a removed native
 * bridge, a changed notification payload shape. Never for a web-only change:
 * those reach every shell on the next page load, which is the entire point.
 */
const MIN_BUILD = 1;

/** Informational, so a support conversation can start from a number. */
const CURRENT_BUILD = 1;

export function GET() {
  return NextResponse.json(
    {
      minBuild: MIN_BUILD,
      currentBuild: CURRENT_BUILD,
      // Shown on the blocking screen, so the copy can change without a release.
      message: "Update Focolare to keep cooking.",
    },
    {
      headers: {
        // Short, not zero: a shell checking on every resume shouldn't hammer
        // this, but an emergency block shouldn't wait an hour to take effect.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
