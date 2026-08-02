/**
 * Converting a plan's wall-clock meal time into a real instant.
 *
 * A user says "dinner at 19:00". That is 19:00 *where they are*, which is a
 * different moment depending on the zone and on whether daylight saving is in
 * effect that day. The server runs in UTC, so the conversion has to be explicit.
 *
 * Done with `Intl` rather than a date library: no new dependency, and the
 * timezone database ships with the runtime, so DST rules stay current.
 */

/** What the given instant reads as, as wall-clock parts, in the target zone. */
function wallPartsInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Intl renders midnight as hour 24 in some locales/zones; normalise it.
  const hour = get("hour") % 24;
  return { y: get("year"), mo: get("month"), d: get("day"), h: hour, mi: get("minute") };
}

/** Milliseconds between a zone's wall clock and UTC at a given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = wallPartsInZone(instant, timeZone);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, 0);
  // Compare whole minutes; seconds-level zone offsets don't exist in practice.
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * `('2026-08-01', '19:00', 'America/New_York')` → the UTC instant of 7pm there.
 *
 * Guesses by treating the wall time as UTC, measures how far off that guess is
 * in the target zone, corrects, then re-measures once. The second pass is what
 * makes DST transitions come out right: the offset at the corrected instant can
 * differ from the offset at the guess.
 *
 * On a spring-forward gap (02:30 where that clock time doesn't exist) this
 * settles on the instant just after the jump rather than throwing, which is the
 * behaviour a cook wants — the reminder still fires.
 */
export function zonedWallTimeToUtc(dateISO: string, timeHHMM: string, timeZone: string): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = timeHHMM.split(":").map(Number);

  const naiveUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!, 0);

  let instant = new Date(naiveUtc - zoneOffsetMs(new Date(naiveUtc), zone));
  // One correction pass, in case the first guess landed on the other side of a
  // DST boundary and so used the wrong offset.
  instant = new Date(naiveUtc - zoneOffsetMs(instant, zone));

  return instant;
}

/** Formats an instant as 'HH:MM' in a zone — for reminder copy. */
export function formatWallTimeInZone(instant: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const p = wallPartsInZone(instant, zone);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}
