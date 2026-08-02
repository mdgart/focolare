/**
 * Cases the pantry matcher must get right, runnable with `npm run check:matching`.
 *
 * The list below is the specification the matcher is written against, and the
 * "false" half is the important half: each of those lines is an ingredient
 * someone would have to buy, and matching it would quietly drop it from the
 * shopping list. Add a case here before widening GRADE_WORDS.
 */
import { buildCoveredSet, ingredientCoveredBy } from "@/lib/normalize-ingredient";

const pantry = [
  "Milk",
  "Flour",
  "Butter",
  "Olive oil",
  "Eggs",
  "Sugar",
  "Yoghurt",
  "Paprika",
  "Chickpeas",
  "Rice",
  "Chocolate",
];
const covered = buildCoveredSet(pantry);

// [recipe ingredient, should it be treated as already-owned?]
const cases: [string, boolean][] = [
  // The reported problem: graded names should now match.
  ["whole milk", true],
  ["semi-skimmed milk", true],
  ["skimmed milk", true],
  ["plain flour", true],
  ["unsalted butter", true],
  ["salted butter", true],
  ["extra-virgin olive oil", true],
  ["extra virgin olive oil", true],
  ["large eggs", true],
  ["large free-range eggs", true],
  ["organic whole milk", true],
  ["milk", true],
  ["eggs", true],
  ["egg", true],
  ["Milk, warmed", true],
  ["low-fat yoghurt", true],
  ["fat-free yoghurt", true],

  // Water and friends: never worth a shopping-list line.
  ["water", true],
  ["cold water", true],
  ["boiling water", true],
  ["ice cubes", true],

  // The lines that must keep reaching the shopping list.
  ["almond milk", false],
  ["coconut milk", false],
  ["oat milk", false],
  ["buttermilk", false],
  ["almond flour", false],
  ["wholemeal flour", false],
  ["self-raising flour", false],
  ["peanut butter", false],
  ["brown sugar", false],
  ["icing sugar", false],
  ["smoked paprika", false],
  ["dried chickpeas", false],
  ["arborio rice", false],
  ["milk chocolate", false],
  ["white chocolate", false],
  ["sparkling water", false],
  ["coconut water", false],
  ["rose water", false],
  ["sesame oil", false],
  ["egg white", false],
  ["egg noodles", false],
];

let failures = 0;
for (const [name, expected] of cases) {
  const actual = ingredientCoveredBy(name, covered);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${name.padEnd(24)} covered=${String(actual).padEnd(5)} expected=${expected}`,
  );
}
console.log(`\n${cases.length - failures}/${cases.length} passed`);
if (failures > 0) process.exit(1);
