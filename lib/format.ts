export const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "QAR", "BHD", "KWD"];

const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: "AED", USD: "$", EUR: "€", GBP: "£",
  SAR: "SAR", QAR: "QAR", BHD: "BHD", KWD: "KWD",
};

export function formatCurrency(amount: number | string | null | undefined, currency = "AED"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const n = Number(amount);
  const abs = Math.abs(Number.isFinite(n) ? n : 0);
  const sign = n < 0 ? "-" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${sym.length > 1 ? " " : ""}${formatted}`;
}

export function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function formatShortDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

/** YYYY-MM-DD in the phone's OWN time zone (not UTC — fixes "yesterday" after midnight in Dubai). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return localISODate(new Date());
}

/** "2026-11" for any date string, using the phone's local time zone. */
export function monthKey(dateStr: string | Date): string {
  const d = typeof dateStr === "string" ? parseDate(dateStr) : dateStr;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse "2026-11-10" as a LOCAL date (JS would treat it as UTC midnight). */
export function parseDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  return new Date(dateStr);
}

/** Is this transaction date inside the given local month ("2026-11")? */
export function inMonth(dateStr: string, key: string): boolean {
  return monthKey(dateStr) === key;
}

export const EXPENSE_CATEGORIES = [
  "Food & Dining", "Transportation", "Housing", "Entertainment",
  "Healthcare", "Shopping", "Education", "Travel", "Utilities", "Other",
];

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Other"];

export const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

/** Short money for small spaces: "AED 77.1K", "AED 1.2M", "AED 950". */
export function formatCompact(amount: number | string | null | undefined, currency = "AED"): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const n = Number(amount);
  const v = Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const sep = sym.length > 1 ? " " : "";
  const trim = (x: string) => x.replace(/\.0$/, "");
  if (abs >= 1_000_000) return `${sign}${sym}${sep}${trim((abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1))}M`;
  if (abs >= 10_000) return `${sign}${sym}${sep}${trim((abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1))}K`;
  return `${sign}${sym}${sep}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
