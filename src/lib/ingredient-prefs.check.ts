/**
 * Cases the reading preferences must get right, via `npm run check:prefs`.
 *
 * The rule that matters most: **a substitution never changes an amount.**
 * Ratios are prose, so rewriting the quantity means guessing — the original
 * number stays and the swap is shown beside it.
 */
import {
  applyPrefs,
  DEFAULT_PREFS,
  normalizePrefs,
  prefsAreCustomised,
  withSubstitution,
} from "@/lib/ingredient-prefs";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const RECIPE = [
  { amount: "500", unit: "g", name: "plain flour" },
  { amount: "280", unit: "g", name: "butter" },
  { amount: "a splash", name: "milk" },
  { name: "salt, to taste" },
];

/* ---------- defaults ---------- */

check("as written by default", prefsAreCustomised(DEFAULT_PREFS), false);
check(
  "...and the lines come back untouched",
  applyPrefs(RECIPE, DEFAULT_PREFS, "metric").map((l) => `${l.amount ?? ""} ${l.unit ?? ""}`.trim()),
  ["500 g", "280 g", "a splash", ""],
);

/* ---------- scaling ---------- */

const doubled = applyPrefs(RECIPE, { ...DEFAULT_PREFS, scalePercent: 200 }, "metric");
check("scaling multiplies readable amounts", doubled[0]?.amount, "1000");
check("...and flags the ones it can't read", doubled[2]?.needsEye, true);
check("...leaving them exactly as written", doubled[2]?.amount, "a splash");

/* ---------- units ---------- */

const inCups = applyPrefs(RECIPE, { ...DEFAULT_PREFS, unitSystem: "us" }, "metric");
check("flour converts to cups", `${inCups[0]?.amount} ${inCups[0]?.unit}`, "4 cups");
check("...and is marked as converted", inCups[0]?.converted, true);
check(
  "asking for the system it's already in changes nothing",
  applyPrefs(RECIPE, { ...DEFAULT_PREFS, unitSystem: "metric" }, "metric")[0]?.amount,
  "500",
);

// Scale then convert, so the arithmetic happens in the recipe's own units.
const both = applyPrefs(RECIPE, { scalePercent: 50, unitSystem: "us", substitutions: [] }, "metric");
check("scaling and converting compose", `${both[0]?.amount} ${both[0]?.unit}`, "2 cups");

/* ---------- substitutions ---------- */

const swapped = withSubstitution(DEFAULT_PREFS, {
  forIngredient: "butter",
  use: "Olive oil",
  ratio: "¾ of the butter weight",
});
const lines = applyPrefs(RECIPE, swapped, "metric");

check("the swap lands on the right line", lines[1]?.swap, {
  use: "Olive oil",
  ratio: "¾ of the butter weight",
});
// The whole point: the number is not touched.
check("...and the amount is untouched", `${lines[1]?.amount} ${lines[1]?.unit}`, "280 g");
check("other lines are unaffected", lines[0]?.swap, null);

check(
  "matching ignores grade words, like the pantry matcher",
  applyPrefs(
    [{ amount: "280", unit: "g", name: "unsalted butter" }],
    swapped,
    "metric",
  )[0]?.swap?.use,
  "Olive oil",
);
check(
  "...but peanut butter is not butter",
  applyPrefs([{ amount: "2", unit: "tbsp", name: "peanut butter" }], swapped, "metric")[0]?.swap,
  null,
);

check(
  "choosing again replaces rather than stacks",
  withSubstitution(swapped, { forIngredient: "Butter", use: "Margarine", ratio: "Equal" })
    .substitutions.length,
  1,
);
check(
  "an empty choice removes the swap",
  withSubstitution(swapped, { forIngredient: "butter", use: "", ratio: "" }).substitutions,
  [],
);

check("any change counts as customised", prefsAreCustomised(swapped), true);

/* ---------- stored values are never trusted ---------- */

check("junk falls back to defaults", normalizePrefs({ scalePercent: "x", unitSystem: "moon" }), DEFAULT_PREFS);
check("an absurd scale is refused", normalizePrefs({ scalePercent: 100000 }).scalePercent, 100);
check("null is safe", normalizePrefs(null), DEFAULT_PREFS);
check(
  "malformed substitutions are dropped",
  normalizePrefs({ substitutions: [{ use: "x" }, { forIngredient: "b", use: "Oil" }] }).substitutions,
  [{ forIngredient: "b", use: "Oil", ratio: "" }],
);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
