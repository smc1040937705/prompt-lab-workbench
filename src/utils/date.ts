export function toDate(input: string | number | Date): Date {
  const value = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Invalid date input: ${String(input)}`);
  }
  return value;
}

export function startOfDay(input: string | number | Date): Date {
  const date = toDate(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function diffInDays(
  from: string | number | Date,
  to: string | number | Date
): number {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  const diff = end - start;
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

export function isOverdue(dateValue: string, today: Date = new Date()): boolean {
  return diffInDays(dateValue, today) > 0;
}

export function formatDate(dateValue: string | Date): string {
  const date = toDate(dateValue);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
