/**
 * Cases the suggestion time limit must get right, runnable with
 * `npm run check:suggest`.
 *
 * The rule under test is that a time limit filters, it doesn't merely score:
 * no combination of "you saved this", "you've cooked this" and "from someone
 * you follow" may put a three-day recipe in a 60-minute slot.
 */
import { fitsInTime, rankCandidates, type SuggestionCandidate } from "@/lib/suggest";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got      ${a}\n        expected ${e}`);
}

const MIN = 60;
const HOUR = 3600;

check("a 54-minute recipe fits an hour", fitsInTime(54 * MIN, 60), true);
check("so does a slight overshoot", fitsInTime(63 * MIN, 60), true);
check("but not a real one", fitsInTime(75 * MIN, 60), false);
check("a 3h35m bread does not fit an hour", fitsInTime(3.6 * HOUR, 60), false);
check("nor a 17-hour loaf", fitsInTime(17 * HOUR, 60), false);
check("nor a 90-day preserve", fitsInTime(90 * 86400, 60), false);
check("no limit set means everything fits", fitsInTime(90 * 86400, null), true);
check("an unstated duration is not treated as long", fitsInTime(0, 60), true);

function candidate(over: Partial<SuggestionCandidate> & { recipeId: string }): SuggestionCandidate {
  return {
    title: over.recipeId,
    coverUrl: null,
    channelTitle: null,
    totalSeconds: 0,
    estimated: false,
    ingredientNames: [],
    isSaved: false,
    isFollowedChannel: false,
    isOwn: false,
    timesCooked: 0,
    cookedWithinAWeek: false,
    popularity: 0,
    ...over,
  };
}

// The reported case: every other signal maxed out on a recipe that takes days.
const ranked = rankCandidates(
  [
    candidate({
      recipeId: "preserved-garlic",
      totalSeconds: 90 * 86400,
      isSaved: true,
      isOwn: true,
      isFollowedChannel: true,
      timesCooked: 9,
      popularity: 20,
    }),
    candidate({ recipeId: "country-loaf", totalSeconds: 17 * HOUR, isSaved: true }),
    candidate({ recipeId: "fudge-cake", totalSeconds: 54 * MIN }),
    candidate({ recipeId: "no-time-given", totalSeconds: 0 }),
  ],
  { timeAvailableMinutes: 60, covered: new Set(), recipeIdsInPlan: new Set() },
);

check(
  "nothing over the limit is suggested, however well it scores",
  ranked.map((r) => r.recipeId).sort(),
  ["fudge-cake", "no-time-given"],
);

const noLimit = rankCandidates(
  [
    candidate({ recipeId: "preserved-garlic", totalSeconds: 90 * 86400, isSaved: true }),
    candidate({ recipeId: "fudge-cake", totalSeconds: 54 * MIN }),
  ],
  { timeAvailableMinutes: null, covered: new Set(), recipeIdsInPlan: new Set() },
);
check("with no limit, long recipes are still offered", noLimit.length, 2);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
if (failures > 0) process.exit(1);
