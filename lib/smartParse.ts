/**
 * "Tell Savify" — turns a sentence into a transaction, on the phone (free, offline).
 *
 *   "I spent 5 dollars on food today"      → expense · 5 USD · Food & Dining · today
 *   "got my salary 12000 in bank"          → income · 12000 · Salary · bank
 *   "taxi 32 card yesterday"               → expense · 32 · Transportation · bank · yesterday
 *   "صرفت ٢٠ درهم على قهوة"                 → expense · 20 AED · Food & Dining
 *
 * Anything it can't find is listed in `missing`, so the app can ask with simple buttons.
 */
import type { AccountType } from "@/lib/types";

export type ParsedTx = {
  type: "expense" | "income";
  amount: number | null;
  currency: string | null; // currency the user SAID (null = not said)
  category: string | null;
  account: AccountType | null;
  date: Date;
  dateLabel: string; // "Today", "Yesterday", "Mon 9 Nov"
  description: string;
  missing: ("amount" | "category" | "account")[];
  /** how sure we are about the type (expense/income) */
  typeSure: boolean;
};

const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "٫": ".", "٬": "," };

const WORD_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const CURRENCY_WORDS: [RegExp, string][] = [
  [/\$|\busd\b|\bdollars?\b|\bbucks?\b|دولار/, "USD"],
  [/\baed\b|\bdhs?\b|\bdirhams?\b|درهم|دراهم/, "AED"],
  [/€|\beur\b|\beuros?\b|يورو/, "EUR"],
  [/£|\bgbp\b|\bpounds?\b|جنيه/, "GBP"],
  [/\bsar\b|\bsaudi riyals?\b|ريال سعودي/, "SAR"],
  [/\bqar\b|\bqatari riyals?\b/, "QAR"],
  [/\bkwd\b|\bkuwaiti dinars?\b/, "KWD"],
  [/\bbhd\b|\bbahraini dinars?\b/, "BHD"],
  [/\bomr\b|\bomani riyals?\b/, "OMR"],
  [/\binr\b|\brupees?\b|₹/, "INR"],
];

/** Keyword → category. First match wins, so more specific words come first. */
const CATEGORY_WORDS: [string, string[]][] = [
  ["Salary", ["salary", "payroll", "paycheck", "wage", "wages", "راتب", "الراتب"]],
  ["Freelance", ["freelance", "client", "invoice", "project payment", "side job", "commission"]],
  ["Investment", ["dividend", "interest", "investment", "stocks", "stock", "profit", "crypto", "أرباح"]],
  ["Gift", ["gift", "present", "eidiya", "eidi", "هدية", "عيدية"]],
  ["Housing", ["rent", "mortgage", "landlord", "maintenance", "ejari", "إيجار", "ايجار"]],
  ["Utilities", ["electricity", "water bill", "dewa", "sewa", "addc", "internet", "wifi", "wi-fi", "phone bill", "mobile bill", "recharge", "etisalat", "du bill", "gas bill", "utilities", "كهرباء", "انترنت"]],
  ["Transportation", ["taxi", "uber", "careem", "petrol", "fuel", "gas station", "metro", "bus", "tram", "parking", "salik", "toll", "car wash", "car service", "tyre", "tire", "بنزين", "تاكسي"]],
  ["Food & Dining", ["food", "lunch", "dinner", "breakfast", "brunch", "coffee", "cafe", "café", "restaurant", "groceries", "grocery", "supermarket", "carrefour", "lulu", "snack", "pizza", "burger", "shawarma", "karak", "tea", "juice", "talabat", "deliveroo", "noon food", "bakery", "meal", "قهوة", "غداء", "عشاء", "فطور", "أكل", "اكل", "مطعم", "بقالة"]],
  ["Healthcare", ["doctor", "pharmacy", "medicine", "hospital", "clinic", "dentist", "gym", "fitness", "insurance", "vitamins", "صيدلية", "دكتور", "مستشفى"]],
  ["Entertainment", ["movie", "cinema", "netflix", "spotify", "shahid", "osn", "game", "playstation", "xbox", "concert", "party", "subscription", "سينما"]],
  ["Education", ["school", "tuition", "course", "class", "book", "books", "university", "exam", "مدرسة", "دورة", "كتب"]],
  ["Travel", ["flight", "hotel", "airbnb", "trip", "travel", "visa", "ticket", "holiday", "vacation", "طيران", "فندق", "سفر"]],
  ["Shopping", ["clothes", "shoes", "amazon", "noon", "mall", "shopping", "shirt", "dress", "bag", "watch", "phone", "laptop", "electronics", "furniture", "ikea", "ملابس", "تسوق"]],
];

const INCOME_HINTS = /\b(got paid|received|receive|earned|earn|income|salary|got my|credited|deposit(ed)?|refund(ed)?|sold|bonus|cashback|won)\b|راتب|استلمت|وصلني|ربحت/;
const EXPENSE_HINTS = /\b(spent|spend|paid|pay|bought|buy|cost|costs|for|on|charged|purchase(d)?|bill)\b|صرفت|دفعت|اشتريت/;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const EXPENSE_CATS = ["Food & Dining", "Transportation", "Housing", "Entertainment", "Healthcare", "Shopping", "Education", "Travel", "Utilities", "Other"];
export const INCOME_CATS = ["Salary", "Freelance", "Investment", "Gift", "Other"];
const INCOME_CAT_SET = new Set(["Salary", "Freelance", "Investment", "Gift"]);

function dayStart(d: Date) { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; }

export function dateLabelFor(d: Date): string {
  const today = dayStart(new Date());
  const diff = Math.round((today.getTime() - dayStart(d).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}

function parseAmount(t: string): number | null {
  // "5k", "1.5k", "12,000", "12000.50"
  const k = t.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]!) * 1000 * 100) / 100;
  const nums = [...t.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0].replace(/,/g, "")));
  // ignore numbers that are clearly dates ("5th", "2 days ago")
  const cleaned = t.replace(/\b\d+\s*(st|nd|rd|th)\b/g, "").replace(/\b\d+\s+days?\s+ago\b/g, "");
  const nums2 = [...cleaned.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0].replace(/,/g, "")));
  const pick = nums2.length ? nums2 : nums;
  if (pick.length) return Math.max(...pick.filter((n) => Number.isFinite(n)));

  // number words: "twenty five", "a hundred", "two thousand"
  const words = t.split(/[\s-]+/);
  let total = 0, current = 0, found = false;
  for (const w of words) {
    if (w in WORD_NUM) { current += WORD_NUM[w]!; found = true; }
    else if (w === "hundred") { current = (current || 1) * 100; found = true; }
    else if (w === "thousand") { total += (current || 1) * 1000; current = 0; found = true; }
    else if ((w === "a" || w === "an") && found === false) { /* "a hundred" handled above */ }
  }
  const val = total + current;
  return found && val > 0 ? val : null;
}

function parseDate(t: string): Date {
  const now = new Date();
  if (/\byesterday\b|أمس|امس/.test(t)) { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
  const ago = t.match(/\b(\d+)\s+days?\s+ago\b/);
  if (ago) { const d = new Date(now); d.setDate(d.getDate() - parseInt(ago[1]!, 10)); return d; }
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(last\\s+|on\\s+)?${WEEKDAYS[i]}\\b`).test(t)) {
      const d = new Date(now);
      let back = (now.getDay() - i + 7) % 7;
      if (back === 0) back = 7;
      d.setDate(d.getDate() - back);
      return d;
    }
  }
  return now;
}

function parseAccount(t: string): AccountType | null {
  if (/\bcash\b|كاش|نقد/.test(t)) return "cash";
  if (/\bsavings?\b|توفير/.test(t)) return "savings";
  if (/\b(bank|card|credit|debit|visa|mastercard|apple pay|google pay|transfer|online)\b|بنك|بطاقة|كارت/.test(t)) return "bank";
  return null;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function parseSentence(input: string): ParsedTx {
  let t = input.toLowerCase().trim();
  t = t.replace(/[٠-٩٫٬]/g, (c) => AR_DIGITS[c] ?? c);

  const amount = parseAmount(t);
  let currency: string | null = null;
  for (const [re, code] of CURRENCY_WORDS) if (re.test(t)) { currency = code; break; }

  let category: string | null = null;
  let keyword = "";
  for (const [cat, words] of CATEGORY_WORDS) {
    const w = words.find((k) => (/^[a-z]/.test(k) ? new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(t) : t.includes(k)));
    if (w) { category = cat; keyword = w; break; }
  }

  const incomeHint = INCOME_HINTS.test(t);
  const expenseHint = EXPENSE_HINTS.test(t);
  let type: "expense" | "income" = "expense";
  let typeSure = expenseHint;
  if (category && INCOME_CAT_SET.has(category)) { type = "income"; typeSure = true; }
  else if (incomeHint && !/\b(spent|paid|bought)\b/.test(t)) { type = "income"; typeSure = true; }
  if (type === "income" && category && !INCOME_CAT_SET.has(category)) category = "Other";
  if (type === "expense" && category && INCOME_CAT_SET.has(category)) category = null;

  const date = parseDate(t);
  const account = parseAccount(t);

  const description = keyword && /^[a-z]/.test(keyword) ? cap(keyword) : category ?? (type === "income" ? "Income" : "Expense");

  const missing: ParsedTx["missing"] = [];
  if (!amount) missing.push("amount");
  if (!category) missing.push("category");
  if (!account) missing.push("account");

  return { type, amount, currency, category, account, date, dateLabel: dateLabelFor(date), description, missing, typeSure };
}

/**
 * Approximate exchange rates (1 unit → USD). Gulf currencies are pegged, so they are exact.
 * Others are rough and only used when the user says a different currency.
 */
const TO_USD: Record<string, number> = {
  USD: 1, AED: 1 / 3.6725, SAR: 1 / 3.75, QAR: 1 / 3.64, BHD: 1 / 0.376, OMR: 1 / 0.3845, KWD: 1 / 0.307,
  EUR: 1.08, GBP: 1.27, INR: 1 / 84,
};

export function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  const a = TO_USD[from], b = TO_USD[to];
  if (!a || !b) return null;
  return Math.round(((amount * a) / b) * 100) / 100;
}

export const EXAMPLES = [
  "Lunch 35 cash",
  "Taxi 28 card yesterday",
  "Salary 12000 bank",
  "Groceries 240 at Carrefour",
  "Paid rent 4500",
];
