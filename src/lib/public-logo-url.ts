import fs from "node:fs";
import path from "node:path";

/** Cache-bust a public logo file using on-disk mtime so replacements show without clearing caches. */
function bustedUrl(file: string): string {
  try {
    const mtime = fs.statSync(path.join(process.cwd(), "public", file)).mtimeMs;
    return `/${file}?v=${Math.trunc(mtime)}`;
  } catch {
    return `/${file}`;
  }
}

/** Raster logo — for contexts that need PNG (apple-touch-icon, PWA manifest). */
export function getPublicLogoUrl(): string {
  return bustedUrl("logo.png");
}

/** Vector logo with its rounded background tile — for favicons and app icons. */
export function getPublicLogoSvgUrl(): string {
  return bustedUrl("logo.svg");
}

/** Bare vector mark that fills its box — for in-app UI on an existing background. */
export function getPublicLogoMarkUrl(): string {
  return bustedUrl("logo-mark.svg");
}
