/** Datumi u zoni Europe/Zagreb. Dan je uvijek string "YYYY-MM-DD". */

export const TIME_ZONE = "Europe/Zagreb";
export const DAYS_AHEAD = 6;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function zagrebDate(at: Date = new Date()): string {
  // en-CA daje format YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function zagrebHour(at: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(at);
  return Number(h);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Danas + 6 dana unaprijed. */
export function selectableDays(today: string = zagrebDate()): string[] {
  return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
}

export function isSelectableDay(date: string | undefined | null, today: string = zagrebDate()): date is string {
  return !!date && DATE_RE.test(date) && selectableDays(today).includes(date);
}

const WEEKDAYS = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];

/** Oznaka dana za odabir: "Danas", "Sutra", "pon 13.10." */
export function dayLabel(date: string, today: string = zagrebDate()): string {
  if (date === today) return "Danas";
  if (date === addDays(today, 1)) return "Sutra";
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}
