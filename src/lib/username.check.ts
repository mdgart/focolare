/**
 * What a profile address has to get right, runnable with `npm run check:usernames`.
 *
 * Two rules under test. A username people never chose comes from their email —
 * mauro.degiorgi@gmail.com owns /c/mauro.degiorgi, dots intact — and a second
 * person with that name gets .1 rather than a random tail. And a username
 * someone types is folded into something URL-safe instead of rejected, unless
 * what's left is too short or reserved.
 */
import {
  defaultUsernameBase,
  isLegacyGeneratedUsername,
  normalizeUsername,
  suffixedUsername,
  usernameCandidates,
  usernameFromEmail,
  validateUsername,
} from "@/lib/username";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

check("the email's local part keeps its dots", usernameFromEmail("mauro.degiorgi@gmail.com"), "mauro.degiorgi");
check("a +tag is not part of the name", usernameFromEmail("mauro+recipes@gmail.com"), "mauro");
check("capitals and spaces fold down", normalizeUsername("Mauro De Giorgi"), "mauro-de-giorgi");
check("accents lose their marks", normalizeUsername("Niccolò"), "niccolo");
check("punctuation runs collapse", normalizeUsername("a...b---c"), "a.b-c");
check("it can't start or end on punctuation", normalizeUsername("-.focolare.-"), "focolare");
check("emoji-only leaves nothing", normalizeUsername("🍅🍝"), "");

check("email beats display name", defaultUsernameBase({ email: "mauro.degiorgi@gmail.com", displayName: "Focolare" }), "mauro.degiorgi");
check("display name covers a missing email", defaultUsernameBase({ email: null, displayName: "Focolare" }), "focolare");
check("a two-letter local part falls through", defaultUsernameBase({ email: "mg@gmail.com", displayName: "Mauro" }), "mauro");
check("with nothing usable, everyone is a cook", defaultUsernameBase({ email: "mg@x.com", displayName: "🍅" }), "cook");
check("a reserved local part is not handed out", defaultUsernameBase({ email: "admin@x.com", displayName: "Admin" }), "cook");

check(
  "the taken name is followed by numbered alternatives",
  usernameCandidates("mauro.degiorgi", 4),
  ["mauro.degiorgi", "mauro.degiorgi.1", "mauro.degiorgi.2", "mauro.degiorgi.3"],
);
check(
  "a suffix on a max-length name trims the name, not the suffix",
  suffixedUsername("a".repeat(30), 7),
  `${"a".repeat(28)}.7`,
);
check("trimming never leaves a doubled separator", suffixedUsername(`${"a".repeat(27)}-bcd`, 1), `${"a".repeat(27)}.1`);

check("a typed name comes back normalized", validateUsername("  Mauro De Giorgi "), { username: "mauro-de-giorgi" });
check("two letters is too short", validateUsername("mg"), { error: "Usernames need at least 3 letters or numbers." });
check("a name that is all punctuation is too short", validateUsername("..."), { error: "Usernames need at least 3 letters or numbers." });
check("blank asks for a name", validateUsername("   "), { error: "Pick a username." });
check("31 characters is too long", validateUsername("a".repeat(31)), { error: "Usernames can be at most 30 characters." });
check("leading punctuation is dropped rather than refused", validateUsername("_focolare_"), { username: "focolare" });
check("staff names are off limits", validateUsername("Admin"), { error: "That username is reserved. Try another one." });
check("the brand is not off limits", validateUsername("focolare"), { username: "focolare" });

check("an old generated slug is recognised", isLegacyGeneratedUsername("focolare-o00hik", "focolare"), true);
check("a chosen name that merely looks generated is left alone", isLegacyGeneratedUsername("home-cooked", "home cooking"), false);
check("a plain name is not generated", isLegacyGeneratedUsername("focolare", "focolare"), false);

console.log(failures === 0 ? "\nAll username checks passed." : `\n${failures} failing check(s).`);
if (failures > 0) process.exitCode = 1;
