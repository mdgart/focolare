/** Human-readable duration from total seconds (for timers / display). */
export function humanDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";
  const d = Math.floor(totalSeconds / 86400);
  const rest = totalSeconds % 86400;
  const h = Math.floor(rest / 3600);
  const m = Math.round((rest % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

/** Split total seconds into day/hour/minute form fields (empty strings when zero). */
export function secondsToDurationParts(totalSeconds: number | null | undefined): {
  days: string;
  hours: string;
  minutes: string;
} {
  if (totalSeconds == null || totalSeconds <= 0) return { days: "", hours: "", minutes: "" };
  const s = Math.round(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return {
    days: d > 0 ? String(d) : "",
    hours: h > 0 ? String(h) : "",
    minutes: m > 0 || (d === 0 && h === 0) ? String(m) : "",
  };
}

/** Step duration from days + hours + minutes (any can be zero). */
export function durationPartsToSeconds(
  daysStr: string,
  hoursStr: string,
  minutesStr: string,
): number | null {
  const d = Math.max(0, Number(daysStr) || 0);
  const h = Math.max(0, Number(hoursStr) || 0);
  const m = Math.max(0, Number(minutesStr) || 0);
  const sec = Math.round(d * 86400 + h * 3600 + m * 60);
  return sec > 0 ? sec : null;
}

/** Gap after previous step: days + hours + minutes. */
export function offsetPartsToSeconds(daysStr: string, hoursStr: string, minutesStr: string): number {
  const d = Math.max(0, Number(daysStr) || 0);
  const h = Math.max(0, Number(hoursStr) || 0);
  const m = Math.max(0, Number(minutesStr) || 0);
  return Math.round(d * 86400 + h * 3600 + m * 60);
}

/** Countdown display: `Nd HH:MM:SS` when ≥ 1 day, else `H+:MM:SS` (hours may exceed 24). */
export function formatDurationClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) {
    return `${d}d ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }
  const totalH = Math.floor(s / 3600);
  const hh = totalH >= 100 ? String(totalH) : totalH.toString().padStart(2, "0");
  return `${hh}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
