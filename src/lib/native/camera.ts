"use client";

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

/**
 * Taking a photo of the thing you just cooked, from the phone that's in the room.
 *
 * A `<input type="file">` does work in a WebView, but it opens a file picker —
 * which for someone photographing a loaf they just pulled out of the oven means
 * Camera → shoot → Photos → find it → attach, when it should be one tap. The
 * native sheet offers camera and library together and returns the result
 * directly.
 *
 * Returns a `File` so the caller's upload path is untouched: this is a
 * different way to *choose* an image, not a different way to send one.
 */

/** Matches the accept list on the web input, so the server sees the same shapes. */
const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function pickNativeImage(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    // Prompt shows camera *and* library, so one control covers both intents
    // rather than forcing a choice before the sheet appears.
    source: CameraSource.Prompt,
    resultType: CameraResultType.Uri,
    /**
     * Re-encoded at 85%: a modern phone camera produces 4–12 MB frames, and a
     * recipe photo is displayed at card size. Uploading the original would be
     * slow on a kitchen's wifi for no visible gain.
     */
    quality: 85,
    width: 2048,
    /** Cropping belongs to the cook, not to us guessing at the subject. */
    allowEditing: false,
    // Without this the sheet has no way back and the only exit is the app switcher.
    promptLabelCancel: "Cancel",
  });

  if (!photo.webPath) return null;

  // The plugin hands back a local URI; fetching it yields the bytes. This is a
  // file:// or capacitor:// read, not a network call.
  const blob = await (await fetch(photo.webPath)).blob();
  const format = photo.format?.toLowerCase() ?? "jpeg";
  const type = MIME_BY_FORMAT[format] ?? blob.type ?? "image/jpeg";

  return new File([blob], `photo.${format === "jpg" ? "jpeg" : format}`, { type });
}
