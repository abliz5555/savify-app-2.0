import type { RecurringExpense } from "@/lib/types";

/** The next date this bill is due (local time). Day 29/30/31 is clamped to short months. */
export function billDueDate(bill: Pick<RecurringExpense, "nextDueDate" | "dueDay">): Date {
  if (bill.nextDueDate) {
    const [y, m, d] = bill.nextDueDate.slice(0, 10).split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = (y: number, m: number) => new Date(y, m, Math.min(bill.dueDay, new Date(y, m + 1, 0).getDate()));
  let d = at(today.getFullYear(), today.getMonth());
  if (d < today) d = at(today.getFullYear(), today.getMonth() + 1);
  return d;
}

/** Whole days from today until the date (negative = overdue). */
export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** Roughly how much a bill costs per month. */
export function monthlyEquivalent(bill: Pick<RecurringExpense, "amount" | "frequency">): number {
  const f = bill.frequency === "weekly" ? 52 / 12 : bill.frequency === "yearly" ? 1 / 12 : bill.frequency === "daily" ? 365 / 12 : 1;
  return bill.amount * f;
}
