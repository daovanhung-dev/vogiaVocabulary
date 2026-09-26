function dateKey(value: Date, timeZone: string): string | null {
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values['year'] || !values['month'] || !values['day']) return null;
  return `${values['year']}-${values['month']}-${values['day']}`;
}

function shiftDateKey(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function calculateReviewStreakDays(
  timestamps: string[],
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): number {
  const today = dateKey(now, timeZone);
  if (!today) return 0;
  const reviewedDates = new Set(
    timestamps
      .map((timestamp) => dateKey(new Date(timestamp), timeZone))
      .filter((value): value is string => Boolean(value)),
  );
  const yesterday = shiftDateKey(today, -1);
  let cursor = reviewedDates.has(today) ? today : reviewedDates.has(yesterday) ? yesterday : null;
  let streak = 0;

  while (cursor && reviewedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}
