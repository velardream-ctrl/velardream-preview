const clock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Helsinki",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function resolveHelsinki(date, time, later = false) {
  const wall = Date.parse(date + "T" + time + ":00Z");
  if (!Number.isFinite(wall)) return null;
  const possible = [3, 2]
    .map((offset) => wall - offset * 3600000)
    .filter((t) => clock.format(t) === date + " " + time);
  return (later ? possible.at(-1) : possible[0]) ?? null;
}
export function helsinkiDate(ms) {
  return clock.format(ms).slice(0, 10);
}
