/** Local clock and zone labels for the HUD readouts. Client-side only (uses "now"). */

const ABBR: Record<string, [standard: string, daylight: string]> = {
  "America/New_York": ["EST", "EDT"],
  "America/Chicago": ["CST", "CDT"],
  "America/Denver": ["MST", "MDT"],
  "America/Los_Angeles": ["PST", "PDT"],
  "America/Santo_Domingo": ["AST", "AST"],
  "Europe/London": ["GMT", "BST"],
  "Europe/Paris": ["CET", "CEST"],
  "Europe/Rome": ["CET", "CEST"],
  "Europe/Monaco": ["CET", "CEST"],
  "Europe/Budapest": ["CET", "CEST"],
  "Europe/Bratislava": ["CET", "CEST"],
  "Asia/Tokyo": ["JST", "JST"],
};

/** Minutes east of UTC for `tz` at `date`. */
export function utcOffsetMinutes(tz: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "−";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** "JST (UTC+9)" */
export function tzLabel(tz: string, date = new Date()) {
  const offset = utcOffsetMinutes(tz, date);
  const year = date.getUTCFullYear();
  const jan = utcOffsetMinutes(tz, new Date(Date.UTC(year, 0, 1)));
  const jul = utcOffsetMinutes(tz, new Date(Date.UTC(year, 6, 1)));
  const dst = offset !== Math.min(jan, jul);
  const abbr = ABBR[tz]?.[dst ? 1 : 0];
  return abbr ? `${abbr} (${formatOffset(offset)})` : formatOffset(offset);
}

/** "21:34" in `tz`. */
export function clock(tz: string, date = new Date(), seconds = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(date);
}
