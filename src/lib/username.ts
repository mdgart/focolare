/**
 * Usernames — the human-readable half of a profile URL, /c/<username>.
 *
 * A profile used to be addressed by a display-name slug plus six random
 * characters (focolare-o00hik), which is unique but unshareable. Now the
 * username is the address: people pick one, and if they never do, the first
 * part of their email stands in (mauro.degiorgi@gmail.com → mauro.degiorgi).
 * Collisions take a numeric suffix — mauro.degiorgi.1, .2 — so the second
 * Mauro still gets something readable.
 *
 * The username lives in channel.slug, which already has a unique index; the
 * database, not this file, is what actually settles a race for a name.
 */

import { foldAccents } from "@/lib/slug";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Names nobody gets to take. Short on purpose: these are the ones that would
 * let a profile pass for staff or for part of the app. Brand and product words
 * are deliberately absent — focolare.app/c/focolare should be someone's.
 */
const RESERVED_USERNAMES = new Set([
  "account",
  "admin",
  "administrator",
  "api",
  "help",
  "mod",
  "moderator",
  "new",
  "root",
  "settings",
  "sign-in",
  "sign-up",
  "staff",
  "support",
  "system",
]);

/**
 * Fold arbitrary text into the username character set: lowercase letters,
 * digits, and the separators . - _ between them. Anything else becomes a
 * hyphen, runs of separators collapse to the first one, and the result never
 * starts or ends with a separator.
 */
export function normalizeUsername(input: string): string {
  const folded = foldAccents(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/([._-])[._-]+/g, "$1");
  return trimSeparators(folded).slice(0, USERNAME_MAX_LENGTH).replace(/[._-]+$/g, "");
}

function trimSeparators(s: string): string {
  return s.replace(/^[._-]+/, "").replace(/[._-]+$/, "");
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username);
}

/**
 * Check a username somebody typed. Returns the normalized form to store, or the
 * message to show them — normalizing rather than rejecting means "Mauro De
 * Giorgi" quietly becomes mauro-de-giorgi instead of failing.
 */
export function validateUsername(input: string): { username: string } | { error: string } {
  const raw = input.trim();
  if (raw.length === 0) return { error: "Pick a username." };

  const username = normalizeUsername(raw);
  if (username.length < USERNAME_MIN_LENGTH) {
    return { error: `Usernames need at least ${USERNAME_MIN_LENGTH} letters or numbers.` };
  }
  if (raw.length > USERNAME_MAX_LENGTH) {
    return { error: `Usernames can be at most ${USERNAME_MAX_LENGTH} characters.` };
  }
  if (isReservedUsername(username)) {
    return { error: "That username is reserved. Try another one." };
  }
  return { username };
}

/** The part of an email address before the @, with any +tag dropped. */
export function usernameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return normalizeUsername(local.split("+")[0] ?? "");
}

/**
 * The username to hand someone who never picked one: their email's local part,
 * falling back to their display name, and finally to "cook" so account creation
 * can't fail over a name.
 */
export function defaultUsernameBase(opts: {
  email?: string | null;
  displayName?: string | null;
}): string {
  const candidates = [
    opts.email ? usernameFromEmail(opts.email) : "",
    opts.displayName ? normalizeUsername(opts.displayName) : "",
  ];
  for (const candidate of candidates) {
    if (candidate.length >= USERNAME_MIN_LENGTH && !isReservedUsername(candidate)) {
      return candidate;
    }
  }
  return "cook";
}

/**
 * The nth alternative to a taken username: mauro.degiorgi.1, .2, … The base is
 * trimmed if the suffix would push it past the length limit.
 */
export function suffixedUsername(base: string, n: number): string {
  const suffix = `.${n}`;
  const room = USERNAME_MAX_LENGTH - suffix.length;
  const head = trimSeparators(base.slice(0, room)) || "cook";
  return `${head}${suffix}`;
}

/** The base name first, then numbered alternatives — in the order to try them. */
export function usernameCandidates(base: string, count = 10): string[] {
  const list = [base];
  for (let n = 1; n < count; n++) list.push(suffixedUsername(base, n));
  return list;
}

/**
 * True for a slug the old scheme generated: the display name's slug plus six
 * random characters. Matching against the title rather than a bare pattern
 * keeps a chosen name like "home-cooked" from looking generated.
 */
export function isLegacyGeneratedUsername(slug: string, titleSlug: string): boolean {
  if (titleSlug.length === 0) return false;
  return new RegExp(`^${escapeForRegExp(titleSlug)}-[a-z0-9_-]{6}$`).test(slug);
}

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}
