/**
 * Cases the unit converter must get right, runnable with `npm run check:units`.
 *
 * The half that matters is the refusals. Weight-to-weight and volume-to-volume
 * are fixed ratios and can only be wrong by arithmetic; crossing between them
 * needs to know what the ingredient *is*, and a guessed density is a cake that
 * doesn't rise with nothing on screen to explain why.
 */
import { parseNumber } from "@/lib/scale-amount";
import { convertIngredient, densityFor, resolveUnit } from "@/lib/unit-convert";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const to = (amount: string, unit: string, name: string, system: "metric" | "us") =>
  convertIngredient({ amount, unit, name }, system, parseNumber(amount));

/* ---------- units are recognised however they're written ---------- */

check("grams", resolveUnit("grams")?.label, "g");
check("Tablespoons", resolveUnit("Tablespoons")?.label, "tbsp");
check("a trailing full stop", resolveUnit("tbsp.")?.label, "tbsp");
check("cups", resolveUnit("cups")?.label, "cups");
check("an unknown unit is not invented", resolveUnit("pinch"), null);
check("nor is a missing one", resolveUnit(undefined), null);

/* ---------- same kind of measure: always safe ---------- */

check("cups of water to metric", to("1 1/2", "cups", "lukewarm water", "metric"), {
  amount: "355",
  unit: "ml",
});
check("ml to cups", to("500", "ml", "milk", "us")?.unit, "cups");
check("grams to ounces", to("500", "g", "beef mince", "metric"), null);
check("a big weight lands in kg", to("3", "lb", "flour", "metric")?.unit, "kg");
check("small volumes land in spoons, not fractions of a cup", to("15", "ml", "vanilla", "us"), {
  amount: "1",
  unit: "tbsp",
});

/* ---------- crossing weight and volume: only with a known density ---------- */

check("cups of flour become grams", to("3", "cups", "all-purpose flour", "metric"), {
  amount: "375",
  unit: "g",
});
check("cups of sugar become grams", to("1", "cup", "caster sugar", "metric"), {
  amount: "200",
  unit: "g",
});
check("grams of flour become cups", to("250", "g", "plain flour", "us"), {
  amount: "2",
  unit: "cups",
});
check("butter too", to("227", "g", "unsalted butter", "us"), { amount: "1", unit: "cups" });

// Liquids stay liquid: metric wants millilitres for these, not grams.
check("water goes to ml, not grams", to("2", "cups", "water", "metric")?.unit, "ml");
check("milk goes to ml", to("1", "cup", "whole milk", "metric")?.unit, "ml");

/* ---------- the refusals ---------- */

check("an ingredient with no known density keeps its kind", to("2", "cups", "gochujang", "metric"), {
  amount: "473",
  unit: "ml",
});
check("no unit, no conversion", to("3", "", "eggs", "metric"), null);
check("an unreadable amount converts nothing", to("a splash", "cups", "milk", "metric"), null);
check("already metric, nothing to do", to("500", "g", "flour", "metric"), null);
check("already US, nothing to do", to("2", "cups", "flour", "us"), null);

// Densities must not leak between ingredients the way a substring match would.
check("almond flour has its own density", densityFor("almond flour") !== densityFor("plain flour"), true);
check("smoked paprika has none", densityFor("smoked paprika"), null);
check("peanut butter is not butter", densityFor("peanut butter"), null);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
