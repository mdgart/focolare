import { dispatchDuePushEvents } from "@/lib/push-dispatch";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : new URL(request.url).searchParams.get("secret");
  if (token !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await dispatchDuePushEvents();
  return Response.json(result);
}
