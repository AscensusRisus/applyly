const DAYS_IN_WEEK = 7;
const WEEKS_IN_GRID = 53;
const DAYS_IN_GRID = DAYS_IN_WEEK * WEEKS_IN_GRID;

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseStoredDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || dateKey(date) !== value ? null : date;
}

function calendarDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * Build a GitHub-style activity grid from persisted application dates.
 * The 53 complete weeks are Sunday-first; future padding cells never count.
 * @param {{ appliedDate: string }[]} applications
 * @param {Date} [now]
 */
export function buildApplicationActivity(applications, now = new Date()) {
  const today = startOfLocalDay(now);
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - 364 - gridStart.getDay());
  const startDayNumber = calendarDayNumber(gridStart);
  const todayDayNumber = calendarDayNumber(today);
  const counts = new Map();

  for (const application of applications) {
    const date = parseStoredDate(application.appliedDate);
    if (!date) continue;
    const dayNumber = calendarDayNumber(date);
    const offset = dayNumber - startDayNumber;
    if (offset < 0 || offset >= DAYS_IN_GRID || dayNumber > todayDayNumber) continue;
    const key = dateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(0, ...counts.values());
  const days = Array.from({ length: DAYS_IN_GRID }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    const isFuture = calendarDayNumber(date) > todayDayNumber;
    const count = isFuture ? 0 : (counts.get(key) ?? 0);
    return {
      date: key,
      count,
      isFuture,
      level: count ? Math.max(1, Math.ceil((count / maxCount) * 4)) : 0,
      label: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    };
  });
  const recordedDays = days.filter(day => !day.isFuture);

  return {
    weeks: Array.from({ length: WEEKS_IN_GRID }, (_, week) => days.slice(week * DAYS_IN_WEEK, week * DAYS_IN_WEEK + DAYS_IN_WEEK)),
    total: recordedDays.reduce((sum, day) => sum + day.count, 0),
    activeDays: recordedDays.filter(day => day.count > 0).length,
    busiest: recordedDays.reduce((best, day) => day.count > (best?.count ?? 0) ? day : best, null),
  };
}
