import { dispatchDuePushEvents } from "@/lib/push-dispatch";
import { cronUnauthorizedResponse } from "@/lib/cron-auth";

/** Legacy / alternate cron URL — same behavior as `GET /api/cron/dispatch`. */
export async function GET(request: Request) {
  const denied = cronUnauthorizedResponse(request);
  if (denied) return denied;
  const result = await dispatchDuePushEvents();
  return Response.json(result);
}
