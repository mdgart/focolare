import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { mediaAsset } from "@/db/schema";
import { getAiQuota, quotaExceededMessage, recordAiUsage } from "@/lib/entitlements";
import {
  getOpenAI,
  isAiRecipeEnabled,
  RECIPE_IMAGE_MODEL,
  RECIPE_IMAGE_QUALITY,
} from "@/lib/openai";
import { storeFile } from "@/lib/storage";

/** Generate a cover photo for a recipe with OpenAI and store it like a normal upload. */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiRecipeEnabled()) {
    return Response.json({ error: "AI image generation is not configured on this server." }, { status: 503 });
  }

  const quota = await getAiQuota(session.user.id, "image");
  if (!quota.allowed) {
    return Response.json({ error: quotaExceededMessage("image", quota) }, { status: 402 });
  }

  let body: { title?: string; description?: string };
  try {
    body = (await req.json()) as { title?: string; description?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title required" }, { status: 400 });
  const description = body.description?.trim().slice(0, 400) ?? "";

  const prompt = [
    `Professional food photography of ${title}.`,
    description ? `The dish: ${description}` : "",
    "Rustic warm editorial style on a natural wood or linen surface, soft window light,",
    "shallow depth of field, appetizing and realistic.",
    "No text, no watermarks, no hands, no people.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const openai = getOpenAI();
    const result = await openai.images.generate({
      model: RECIPE_IMAGE_MODEL,
      prompt,
      size: "1536x1024",
      // Pinned: the API defaults to `auto`, whose tiers differ by more than 10x
      // in price per image, which makes per-user cost impossible to budget.
      quality: RECIPE_IMAGE_QUALITY,
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return Response.json({ error: "Image generation returned no data" }, { status: 502 });
    const buf = Buffer.from(b64, "base64");

    const stored = await storeFile({
      data: buf,
      contentType: "image/png",
      prefix: "ai-covers",
    });

    const [row] = await db
      .insert(mediaAsset)
      .values({
        ownerUserId: session.user.id,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        mimeType: "image/png",
        kind: "image",
      })
      .returning();

    await recordAiUsage(session.user.id, "image");
    return Response.json({ media: row });
  } catch (e) {
    console.error("[ai] cover generation failed:", e);
    return Response.json({ error: "Image generation failed — try again in a moment." }, { status: 502 });
  }
}
