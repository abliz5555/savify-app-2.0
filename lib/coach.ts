/**
 * Savify Smart Coach — 100% free, works offline, runs on the phone.
 *
 * Looks at your transactions, budgets, bills, loans and goals and writes
 * short, practical tips with real numbers. No AI service and no internet needed.
 */
import { formatCurrency, monthKey, parseDate } from "@/lib/format";
import type { AggregateData, FinancialProfile } from "@/lib/types";

export type Trend = "up" | "down" | "neutral";

export type Tip = {
  id: string;
  /** emoji */
  icon: string;
  title: string;
  message: string;
  /** "up" = good news, "down" = warning, "neutral" = info */
  trend: Trend;
  /** optional money you could save, e.g. "Save AED 120/month" */
  saving?: string;
  /** higher = shown first */
  priority: number;
};

export type MonthStats = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number; // %
  byCategory: Record<string, number>;
  count: number;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function monthStats(data: AggregateData, key: string): MonthStats {
  const tx = data.transactions.filter((t) => monthKey(t.createdAt) === key);
  const income = tx.filter((t) => t.type === "income").reduce((s, t) => s + n(t.amount), 0);
  const expenses = tx.filter((t) => t.type === "expense").reduce((s, t) => s + n(t.amount), 0);
  const byCategory: Record<string, number> = {};
  tx.filter((t) => t.type === "expense").forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + n(t.amount);
  });
  return {
    income, expenses, net: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    byCategory, count: tx.length,
  };
}

export function monthKeyOffset(offset: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  return monthKey(d);
}

/** Average monthly spending over the last `months` full months (ignores empty months). */
export function avgMonthlyExpenses(data: AggregateData, months = 3): number {
  const vals: number[] = [];
  for (let i = 1; i <= months; i++) {
    const s = monthStats(data, monthKeyOffset(-i));
    if (s.expenses > 0) vals.push(s.expenses);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

const pct = (v: number) => `${Math.round(v)}%`;

export function generateTips(
  data: AggregateData | undefined,
  currency: string,
  profile?: FinancialProfile | null,
  max = 6,
): Tip[] {
  if (!data) return [];
  const money = (v: number) => formatCurrency(Math.round(v), currency).replace(/\.00$/, "");
  const tips: Tip[] = [];
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - day;

  const cur = monthStats(data, monthKeyOffset(0));
  const prev = monthStats(data, monthKeyOffset(-1));

  if (data.transactions.length === 0) {
    return [{
      id: "start", icon: "👋", trend: "neutral", priority: 100,
      title: "Add your first transaction",
      message: "Record your income and a few expenses — your coach will start giving you tips right away.",
    }];
  }

  // 1. Savings rate this month
  if (cur.income > 0) {
    if (cur.savingsRate >= 20) {
      tips.push({
        id: "rate-good", icon: "🏆", trend: "up", priority: 60,
        title: `You're saving ${pct(cur.savingsRate)} of your income`,
        message: `Great job — that's ${money(cur.net)} kept this month. The common goal is 20%, and you're above it.`,
      });
    } else if (cur.savingsRate >= 0) {
      const target = cur.income * 0.2 - cur.net;
      tips.push({
        id: "rate-mid", icon: "🎯", trend: "neutral", priority: 70,
        title: `Savings rate: ${pct(cur.savingsRate)}`,
        message: `To reach the healthy 20% goal, try to keep about ${money(target)} more this month.`,
        saving: `Goal: +${money(target)}`,
      });
    } else {
      tips.push({
        id: "rate-bad", icon: "⚠️", trend: "down", priority: 95,
        title: "You're spending more than you earn",
        message: `This month you spent ${money(-cur.net)} more than your income. Pause non-essential spending until next payday.`,
      });
    }
  } else if (day >= 5) {
    tips.push({
      id: "no-income", icon: "💼", trend: "neutral", priority: 40,
      title: "No income recorded this month",
      message: "Add your salary or other income so your savings rate and tips are accurate.",
    });
  }

  // 2. Month-end forecast (based on spending speed so far)
  if (day >= 5 && cur.expenses > 0) {
    const forecast = (cur.expenses / day) * daysInMonth;
    const ref = cur.income || prev.income;
    if (ref > 0 && forecast > ref) {
      tips.push({
        id: "forecast", icon: "📈", trend: "down", priority: 90,
        title: `On track to spend ${money(forecast)} this month`,
        message: `At this speed you'll go ${money(forecast - ref)} over your income. Spending about ${money(Math.max(0, (ref - cur.expenses) / Math.max(1, daysLeft)))} a day from now keeps you safe.`,
      });
    }
  }

  // 3. Compared with last month
  if (prev.expenses > 0 && day >= 7) {
    // compare the same days (1st → today's date) of last month so it's fair
    const prevKey = monthKeyOffset(-1);
    const prevSameDays = data.transactions
      .filter((t) => t.type === "expense" && monthKey(t.createdAt) === prevKey && parseDate(t.createdAt).getDate() <= day)
      .reduce((s, t) => s + n(t.amount), 0) || prev.expenses * (day / 30);
    const change = ((cur.expenses - prevSameDays) / prevSameDays) * 100;
    if (Math.abs(change) >= 15) {
      tips.push({
        id: "vs-last", icon: change > 0 ? "📊" : "✅", trend: change > 0 ? "down" : "up", priority: change > 0 ? 75 : 50,
        title: change > 0 ? `Spending is up ${pct(change)} vs last month` : `Spending is down ${pct(-change)} vs last month`,
        message: change > 0
          ? "Compared with the same days last month. Check your top categories below to see what changed."
          : "Nice — you're spending less than at this point last month. Keep it going!",
      });
    }
  }

  // 4. Biggest category
  const cats = Object.entries(cur.byCategory).sort((a, b) => b[1] - a[1]);
  if (cats.length && cur.expenses > 0) {
    const [topCat, topAmt] = cats[0]!;
    const share = (topAmt / cur.expenses) * 100;
    if (share >= 35 && topCat !== "Housing") {
      tips.push({
        id: "top-cat", icon: "🔍", trend: "neutral", priority: 65,
        title: `${topCat} is ${pct(share)} of your spending`,
        message: `You've spent ${money(topAmt)} on ${topCat} this month. Cutting it by just 10% would save you about ${money(topAmt * 0.1 * (daysInMonth / Math.max(day, 1)))} a month.`,
        saving: `Save ~${money(topAmt * 0.1 * (daysInMonth / Math.max(day, 1)))}/mo`,
      });
    }
    const prevTop = prev.byCategory[topCat] ?? 0;
    if (prevTop > 0 && topAmt > prevTop * 1.3 && day >= 10) {
      tips.push({
        id: "cat-jump", icon: "🚨", trend: "down", priority: 72,
        title: `${topCat} already higher than all of last month`,
        message: `${money(topAmt)} so far vs ${money(prevTop)} last month.`,
      });
    }
  }

  // 5. Budgets
  for (const b of data.budgetGoals) {
    const spent = cur.byCategory[b.category] ?? 0;
    if (b.monthlyLimit <= 0) continue;
    const used = (spent / b.monthlyLimit) * 100;
    if (used >= 100) {
      tips.push({
        id: `bud-over-${b.id}`, icon: "🛑", trend: "down", priority: 92,
        title: `${b.category} budget is over by ${money(spent - b.monthlyLimit)}`,
        message: `You set ${money(b.monthlyLimit)} and spent ${money(spent)}. Try to avoid this category until next month.`,
      });
    } else if (day >= 5) {
      const projected = (spent / day) * daysInMonth;
      if (projected > b.monthlyLimit && used >= 50) {
        tips.push({
          id: `bud-pace-${b.id}`, icon: "⏳", trend: "down", priority: 80,
          title: `${b.category} budget will run out early`,
          message: `${pct(used)} used with ${daysLeft} days left. Keep it under ${money((b.monthlyLimit - spent) / Math.max(1, daysLeft))} a day.`,
        });
      }
    }
  }
  if (data.budgetGoals.length === 0 && cats.length >= 2) {
    tips.push({
      id: "no-budget", icon: "🧭", trend: "neutral", priority: 35,
      title: "Set a budget for your top category",
      message: `A monthly limit for ${cats[0]![0]} helps you notice overspending before it happens.`,
    });
  }

  // 6. Bills due soon & bill load
  const soon = data.recurring.filter((r) => {
    if (!r.active || !r.nextDueDate) return false;
    const diff = (parseDate(r.nextDueDate).getTime() - parseDate(monthKey(now) + "-" + String(day).padStart(2, "0")).getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  if (soon.length) {
    const total = soon.reduce((s, r) => s + n(r.amount), 0);
    tips.push({
      id: "bills-soon", icon: "🗓️", trend: "neutral", priority: 85,
      title: `${soon.length} bill${soon.length > 1 ? "s" : ""} due this week`,
      message: `${soon.map((r) => r.name).slice(0, 3).join(", ")} — ${money(total)} in total. Make sure the money is ready.`,
    });
  }
  const monthlyBills = data.recurring.filter((r) => r.active).reduce((s, r) => {
    const f = r.frequency === "weekly" ? 4.33 : r.frequency === "yearly" ? 1 / 12 : r.frequency === "daily" ? 30 : 1;
    return s + n(r.amount) * f;
  }, 0);
  const incomeRef = cur.income || prev.income || n(profile?.monthlyIncome);
  if (incomeRef > 0 && monthlyBills / incomeRef > 0.5) {
    tips.push({
      id: "bills-heavy", icon: "🧾", trend: "down", priority: 68,
      title: `Fixed bills take ${pct((monthlyBills / incomeRef) * 100)} of your income`,
      message: "Over 50% is heavy. Review subscriptions and plans you don't use — even one cancellation helps every month.",
    });
  }
  const subs = data.recurring.filter((r) => r.active && r.category === "Entertainment");
  if (subs.length >= 3) {
    const subTotal = subs.reduce((s, r) => s + n(r.amount), 0);
    tips.push({
      id: "subs", icon: "📺", trend: "neutral", priority: 45,
      title: `${subs.length} entertainment subscriptions`,
      message: `They cost ${money(subTotal)} a month (${money(subTotal * 12)} a year). Keep only the ones you use every week.`,
      saving: `Up to ${money(subTotal * 12)}/yr`,
    });
  }

  // 7. Small purchases add up
  const small = data.transactions.filter((t) =>
    t.type === "expense" && monthKey(t.createdAt) === monthKeyOffset(0) && n(t.amount) > 0 && n(t.amount) <= 30);
  if (small.length >= 10) {
    const sum = small.reduce((s, t) => s + n(t.amount), 0);
    tips.push({
      id: "small", icon: "☕", trend: "neutral", priority: 55,
      title: `${small.length} small purchases this month`,
      message: `Little buys added up to ${money(sum)}. Halving them saves around ${money(sum / 2)} a month.`,
      saving: `Save ~${money(sum / 2)}/mo`,
    });
  }

  // 8. Debts (money you borrowed)
  const borrowed = data.loans.filter((l) => l.direction !== "lent");
  const remainingDebt = borrowed.reduce((s, l) => {
    const paid = (l.payments ?? []).reduce((a, p) => a + n(p.amount), 0);
    return s + Math.max(n(l.totalAmount) - paid, 0);
  }, 0);
  if (remainingDebt > 0) {
    const recentPaid = borrowed.flatMap((l) => l.payments ?? [])
      .filter((p) => (now.getTime() - new Date(p.paidAt).getTime()) / 86400000 <= 90)
      .reduce((s, p) => s + n(p.amount), 0) / 3;
    if (recentPaid > 0) {
      const months = Math.ceil(remainingDebt / recentPaid);
      const faster = Math.ceil(remainingDebt / (recentPaid * 1.2));
      tips.push({
        id: "debt", icon: "🏦", trend: "neutral", priority: 58,
        title: `Debt-free in about ${months} month${months > 1 ? "s" : ""}`,
        message: `${money(remainingDebt)} left at your current pace. Paying 20% more (${money(recentPaid * 0.2)}/mo extra) gets you there in ${faster} months.`,
      });
    } else {
      tips.push({
        id: "debt-none", icon: "🏦", trend: "down", priority: 62,
        title: `${money(remainingDebt)} of debt left`,
        message: "No repayments recorded in the last 3 months. Even a small fixed monthly payment builds momentum.",
      });
    }
  }
  const lentOut = data.loans.filter((l) => l.direction === "lent").reduce((s, l) => {
    const paid = (l.payments ?? []).reduce((a, p) => a + n(p.amount), 0);
    return s + Math.max(n(l.totalAmount) - paid, 0);
  }, 0);
  if (lentOut > 0) {
    tips.push({
      id: "lent", icon: "🤝", trend: "neutral", priority: 30,
      title: `${money(lentOut)} is owed to you`,
      message: "A friendly reminder to the people who borrowed from you keeps things clear.",
    });
  }

  // 9. Emergency fund
  const avgExp = avgMonthlyExpenses(data) || cur.expenses;
  if (profile && avgExp > 0) {
    const cushion = n(profile.savingsBalance) + n(profile.bankBalance) + n(profile.cashOnHand);
    const monthsCovered = cushion / avgExp;
    if (monthsCovered < 3) {
      tips.push({
        id: "emergency", icon: "🛡️", trend: "down", priority: 66,
        title: `Your money covers ${monthsCovered.toFixed(1)} months of spending`,
        message: `Experts suggest 3–6 months. Aim for ${money(avgExp * 3)} as a safety cushion, step by step.`,
      });
    } else {
      tips.push({
        id: "emergency-ok", icon: "🛡️", trend: "up", priority: 25,
        title: `Safety cushion: ${monthsCovered.toFixed(1)} months`,
        message: "You could cover over 3 months of spending if income stopped. Well done.",
      });
    }
  }

  // 10. Savings goals with a date
  for (const g of data.savingsGoals) {
    if (!g.targetDate || g.currentAmount >= g.targetAmount) continue;
    const end = parseDate(g.targetDate.slice(0, 10));
    const monthsLeft = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth());
    const need = (g.targetAmount - g.currentAmount) / monthsLeft;
    tips.push({
      id: `goal-${g.id}`, icon: "💰", trend: "neutral", priority: 48,
      title: `${g.name}: save ${money(need)} a month`,
      message: `${money(g.targetAmount - g.currentAmount)} to go in ${monthsLeft} month${monthsLeft > 1 ? "s" : ""}.`,
    });
  }

  // De-duplicate, sort by priority, keep the best few
  const seen = new Set<string>();
  return tips
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max);
}
