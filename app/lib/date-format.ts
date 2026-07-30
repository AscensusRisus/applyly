export function formatCalendarDate(date: Date, locale: string) {
  return date.toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatStoredDate(value: string, locale: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { year: "numeric", month: "2-digit", day: "2-digit" });
}