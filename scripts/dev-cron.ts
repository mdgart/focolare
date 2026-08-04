/**
 * Poll the push dispatcher, the way Vercel's scheduled cron does in production.
 *
 * Cook timers are scheduled server-side and only ever fire when something calls
 * `/api/cron/dispatch`. In production `vercel.json` does that every minute;
 * locally nothing does, so timers silently never notify. This is that missing
 * caller.
 *
 * Deliberately faster than once a minute — a minute of granularity means a
 * timer can be up to 60 seconds late, which is fine for a bake and infuriating
 * when you're testing.
 *
 *   npm run dev:cron
 *   DEV_CRON_EVERY=5 npm run dev:cron     # seconds between polls
 *   DEV_CRON_URL=http://localhost:3001 npm run dev:cron
 */
import "dotenv/config";

const base = (process.env.DEV_CRON_URL ?? "http://localhost:3000").replace(/\/$/, "");
const everySeconds = Number(process.env.DEV_CRON_EVERY ?? 20);
const secret = process.env.CRON_SECRET?.trim();

if (!secret) {
  console.error("CRON_SECRET is not set in .env — the endpoint will refuse every call.");
  process.exit(1);
}

const url = `${base}/api/cron/dispatch?secret=${encodeURIComponent(secret)}`;
console.log(`Polling ${base}/api/cron/dispatch every ${everySeconds}s. Ctrl-C to stop.`);

async function poll() {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ${res.status} ${res.statusText}`);
      return;
    }
    const body = (await res.json()) as {
      attempted: number;
      sent: number;
      skippedNoVapid: boolean;
    };
    // Quiet when there's nothing due, or it drowns the terminal it shares.
    if (body.attempted > 0 || body.skippedNoVapid) {
      console.log(
        `  ${new Date().toLocaleTimeString()} — attempted ${body.attempted}, sent ${body.sent}` +
          (body.skippedNoVapid ? " (no VAPID keys configured, so nothing could be sent)" : ""),
      );
    }
  } catch (err) {
    console.error(`  unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

void poll();
setInterval(() => void poll(), Math.max(1, everySeconds) * 1000);
