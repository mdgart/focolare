/**
 * Cases scaling and substitution must get right, runnable with
 * `npm run check:ingredients`.
 *
 * Both features do arithmetic or give advice about food, so both have a way of
 * being quietly wrong. The rules under test: an amount that can't be read is
 * left alone and flagged rather than guessed at, and the substitution table
 * never answers for an ingredient it wasn't written for.
 */
import { factorForTargetAmount, scaleAmountText, scaleIngredients } from "@/lib/scale-amount";
import { substitutionsFor } from "@/lib/substitutions";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

/* ---------- scaling amounts ---------- */

const scaled = (amount: string, factor: number) => scaleAmountText(amount, factor).text;

check("whole numbers double", scaled("500", 2), "1000");
check("decimals scale", scaled("2.5", 2), "5");
check("comma decimals scale", scaled("2,5", 2), "5");
check("halving gives a fraction glyph", scaled("1", 0.5), "½");
check("a vulgar fraction doubles to a whole", scaled("½", 2), "1");
check("a mixed vulgar fraction scales", scaled("1½", 2), "3");
check("a written fraction scales", scaled("3/4", 2), "1½");
check("a mixed written fraction scales", scaled("1 1/2", 2), "3");
check("thirds survive the round trip", scaled("⅓", 1), "⅓");
check("a range stays a range", scaled("2-3", 2), "4-6");
check("an en-dash range keeps its dash", scaled("2–3", 2), "4–6");
check("a worded range stays worded", scaled("2 to 3", 2), "4 to 6");
check("big numbers round to whole units", scaled("1000", 4 / 3), "1333");
check("mid-size numbers keep a useful decimal", scaled("10", 1.25), "12.5");
check("...but not a pointless one", scaled("10", 2), "20");
check("awkward small numbers fall back to decimals", scaled("1", 0.4), "0.4");

check("unreadable amounts are left exactly as written", scaleAmountText("a splash", 2), {
  text: "a splash",
  scaled: false,
});
check("...and so are packet sizes", scaleAmountText("1 × 28 oz", 2), {
  text: "1 × 28 oz",
  scaled: false,
});
check("an empty amount is nothing to worry about", scaleAmountText("", 2), {
  text: "",
  scaled: true,
});
check("a factor of 1 changes nothing", scaleAmountText("2-3", 1), { text: "2-3", scaled: true });
check("a nonsense factor scales nothing", scaleAmountText("500", 0), {
  text: "500",
  scaled: false,
});

const lines = scaleIngredients(
  [
    { amount: "500", unit: "g", name: "flour" },
    { amount: "a splash", name: "milk" },
    { name: "salt, to taste" },
  ],
  2,
);
check(
  "a whole list scales, flagging only what it couldn't read",
  lines.map((l) => [l.amount ?? "", l.needsEye]),
  [
    ["1000", false],
    ["a splash", true],
    ["", false],
  ],
);
check("units are never converted", scaleIngredients([{ amount: "500", unit: "g", name: "flour" }], 2)[0]?.unit, "g");

/* ---------- scaling off one ingredient ---------- */

check("700 g against a 500 g recipe is 1.4x", factorForTargetAmount("500", 700), 1.4);
check("a range measures off its upper end", factorForTargetAmount("2-3", 6), 2);
check("an unreadable base gives no factor", factorForTargetAmount("a splash", 700), null);
check("a missing base gives no factor", factorForTargetAmount("", 700), null);

/* ---------- substitutions ---------- */

check("a known ingredient has swaps", substitutionsFor("buttermilk")?.ingredient, "Buttermilk");
check("grade words don't hide a match", substitutionsFor("large eggs")?.ingredient, "Eggs");
check("...nor does a prep note", substitutionsFor("Garlic, finely sliced")?.ingredient, "Garlic");
check("...nor does whole milk", substitutionsFor("whole milk")?.ingredient, "Milk");

// The dangerous half: a substance modifier must not inherit the base's swaps.
check("almond milk is not given cow's-milk swaps", substitutionsFor("almond milk"), null);
check("smoked paprika is not told to use paprika", substitutionsFor("smoked paprika"), null);
check("peanut butter is not given butter's swaps", substitutionsFor("peanut butter"), null);
check("an unknown ingredient gets silence", substitutionsFor("gochujang"), null);
check("empty input is safe", substitutionsFor(""), null);

const buttermilk = substitutionsFor("buttermilk");
check("every option says how much to use", buttermilk?.options.every((o) => o.ratio.length > 0), true);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
