/** Shared guard for `GET /api/cron/*` hooks (Bearer, `?secret=`, or Vercel scheduled cron). */
export function cronUnauthorizedResponse(request: Request): Response | null {
  const secretRaw = process.env.CRON_SECRET;
  if (!secretRaw) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const secret = secretRaw.trim();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : new URL(request.url).searchParams.get("secret")?.trim() ?? null;

  if (token === secret) {
    return null;
  }

  // Vercel sets this on real cron invocations. Bearer should still match when the platform sends it,
  // but some projects have seen missing `Authorization` despite CRON_SECRET (e.g. vercel/vercel#11303).
  if (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1") {
    return null;
  }

  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
