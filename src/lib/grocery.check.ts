/**
 * Cases the shopping list must get right, runnable with `npm run check:grocery`.
 *
 * Two rules under test. Grouping by day must not multiply the list: an
 * ingredient several days want appears once, under the first of them. And a
 * rebuild must keep hand-typed rows while dropping rows — ticked or not — that
 * the plan no longer calls for.
 */
import {
  alsoNeededLabel,
  groupByFirstDayNeeded,
  reconcileGroceryRows,
  type ExistingGroceryRow,
  type GroceryDraft,
} from "@/lib/grocery";

type Item = { name: string; neededOn: string[] };

const items: Item[] = [
  { name: "flour", neededOn: ["2026-08-01", "2026-08-02", "2026-08-05"] },
  { name: "butter", neededOn: ["2026-08-01"] },
  { name: "tomatoes", neededOn: ["2026-08-02"] },
  { name: "yeast", neededOn: ["2026-08-02", "2026-08-05"] },
  { name: "batteries", neededOn: [] },
  { name: "mozzarella", neededOn: ["2026-08-05"] },
];

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const groups = groupByFirstDayNeeded(items);

check(
  "days come out chronologically, undated last",
  groups.map((g) => g.date),
  ["2026-08-01", "2026-08-02", "2026-08-05", null],
);

check(
  "every item appears exactly once",
  groups.flatMap((g) => g.items.map((i) => i.name)).sort(),
  items.map((i) => i.name).sort(),
);

check(
  "a multi-day item sits under its first day only",
  groups.find((g) => g.date === "2026-08-01")?.items.map((i) => i.name),
  ["flour", "butter"],
);

check(
  "the later days don't repeat it",
  groups.find((g) => g.date === "2026-08-05")?.items.map((i) => i.name),
  ["mozzarella"],
);

check(
  "items with no day collect at the end",
  groups.at(-1)?.items.map((i) => i.name),
  ["batteries"],
);

check("alsoNeededLabel: single day is silent", alsoNeededLabel(["2026-08-01"]), null);
check(
  "alsoNeededLabel: names one extra day",
  alsoNeededLabel(["2026-08-01", "2026-08-02"]),
  "also Sun 2 Aug",
);
check(
  "alsoNeededLabel: counts once there are several",
  alsoNeededLabel(["2026-08-01", "2026-08-02", "2026-08-05", "2026-08-06"]),
  "also 3 more days",
);

/* ---------- rebuild: what survives ---------- */

function row(over: Partial<ExistingGroceryRow> & { normalizedName: string }): ExistingGroceryRow {
  return {
    id: over.normalizedName,
    checked: false,
    addedManually: false,
    detail: "",
    sources: [],
    coveredByPantry: false,
    ...over,
  };
}

function draft(over: Partial<GroceryDraft> & { normalizedName: string }): GroceryDraft {
  return {
    name: over.normalizedName,
    detail: "",
    sources: [],
    coveredByPantry: false,
    ...over,
  };
}

// The reported case: "Tomato basil soup" was removed from the plan after its
// ingredients had been ticked off, and its rows stayed on the list.
const afterRemovingARecipe = reconcileGroceryRows(
  [
    row({ normalizedName: "garlic cloves", checked: true }),
    row({ normalizedName: "fresh basil", checked: true }),
    row({ normalizedName: "batteries", addedManually: true, checked: true }),
    row({ normalizedName: "flour" }),
  ],
  [draft({ normalizedName: "flour" })],
);

check(
  "a ticked row goes when its recipe leaves the plan",
  afterRemovingARecipe.doomedIds.sort(),
  ["fresh basil", "garlic cloves"],
);
check(
  "a hand-typed row is never dropped, ticked or not",
  afterRemovingARecipe.doomedIds.includes("batteries"),
  false,
);
check(
  "a row the plan still calls for stays put",
  afterRemovingARecipe.doomedIds.includes("flour"),
  false,
);
check("nothing is re-inserted for a row that survived", afterRemovingARecipe.toInsert, []);

const stillNeeded = reconcileGroceryRows(
  [row({ normalizedName: "garlic cloves", checked: true, detail: "3 (Soup)" })],
  [draft({ normalizedName: "garlic cloves", detail: "3 (Soup) · 2 (Ragu)" })],
);
check("a ticked row that's still needed keeps its id", stillNeeded.doomedIds, []);
check(
  "...and gets fresh amounts rather than stale ones",
  stillNeeded.refresh.map((r) => [r.id, r.detail]),
  [["garlic cloves", "3 (Soup) · 2 (Ragu)"]],
);

const unchanged = reconcileGroceryRows(
  [row({ normalizedName: "flour", detail: "500 g (Bread)" })],
  [draft({ normalizedName: "flour", detail: "500 g (Bread)" })],
);
check("an unchanged row is left alone", [unchanged.doomedIds, unchanged.refresh], [[], []]);

const brandNew = reconcileGroceryRows([], [draft({ normalizedName: "yeast" })]);
check(
  "a new ingredient is inserted",
  brandNew.toInsert.map((d) => d.normalizedName),
  ["yeast"],
);

const alreadyTyped = reconcileGroceryRows(
  [row({ normalizedName: "yeast", addedManually: true })],
  [draft({ normalizedName: "yeast" })],
);
check("a recipe doesn't duplicate something already typed in", alreadyTyped.toInsert, []);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
