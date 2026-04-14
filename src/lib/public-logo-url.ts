import fs from "node:fs";
import path from "node:path";

/** Cache-bust `/logo.png` using on-disk mtime so replacements show without clearing caches. */
export function getPublicLogoUrl(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const mtime = fs.statSync(logoPath).mtimeMs;
    return `/logo.png?v=${Math.trunc(mtime)}`;
  } catch {
    return "/logo.png";
  }
}
