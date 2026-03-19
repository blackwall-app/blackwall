import { getLocale } from "@/paraglide/runtime";

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(getLocale(), {
    year: date.getFullYear() == new Date().getFullYear() ? undefined : "2-digit",
    month: "short",
    day: "numeric",
  });
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.345, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelative(date: Date | string, baseDate: Date = new Date()): string {
  const locale = getLocale();
  const d = typeof date === "string" ? new Date(date) : date;
  let diff = (d.getTime() - baseDate.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(diff) < division.amount) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      return rtf.format(Math.round(diff), division.unit);
    }
    diff /= division.amount;
  }

  return d.toLocaleDateString(locale);
}
