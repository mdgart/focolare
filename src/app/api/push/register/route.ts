import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscription } from "@/db/schema";
import { z } from "zod";

const bodySchema = z.object({
  endpoint: z.string().min(8),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;
  await db
    .insert(pushSubscription)
    .values({
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: session.user.id,
      },
    });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint");
  if (!endpoint) return Response.json({ error: "endpoint required" }, { status: 400 });
  await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
  return Response.json({ ok: true });
}
