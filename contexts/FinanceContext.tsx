import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { monthKey } from "@/lib/format";
import { notifyBudgetIfNeeded } from "@/lib/notifications";
import type {
  AccountType, AggregateData, BudgetGoal, FinancialProfile, Loan, LoanPayment,
  RecurringExpense, SavingsGoal, Transaction,
} from "@/lib/types";

/**
 * All money data lives in your free Supabase database.
 * Every change that touches a balance runs as ONE database action
 * (see supabase/setup.sql), so balances can never get out of sync.
 */

// ── Query keys ────────────────────────────────────────────────────────────────

export const FINANCE_KEY = ["finance-data"];

export function userFinanceKey(userId: string | null | undefined): string[] {
  return ["finance-data", userId ?? "__anonymous__"];
}

export function userProfileKey(userId: string | null | undefined): string[] {
  return ["financial-profile", userId ?? "__anonymous__"];
}

// ── Database row shapes (snake_case) ─────────────────────────────────────────

type TxRow = { id: string; user_id: string; type: string; description: string; amount: number | string; category: string; account?: string | null; created_at: string };
type LoanRow = { id: string; user_id: string; lender_name: string; description: string; total_amount: number | string; direction?: string | null; due_date: string | null; created_at: string };
type PayRow = { id: string; loan_id: string; user_id: string; amount: number | string; note: string | null; paid_at: string };
type RecRow = { id: string; user_id: string; name: string; amount: number | string; category: string; due_day: number; active: boolean; frequency: string; notes: string | null; next_due_date: string | null; paid_tx_id?: string | null; created_at: string };
type BudRow = { id: string; user_id: string; name: string; category: string; monthly_limit: number | string; created_at: string };
type SavRow = { id: string; user_id: string; name: string; target_amount: number | string; current_amount: number | string; target_date: string | null; created_at: string };
type ProfileRow = {
  user_id: string;
  cash_on_hand: string | number; bank_balance: string | number; savings_balance: string | number;
  investments: string | number; other_assets: string | number; total_debts: string | number;
  monthly_income: string | number | null; monthly_expenses: string | number | null;
  savings_goal: string | number | null; updated_at: string;
};

// ── Mappers ───────────────────────────────────────────────────────────────────

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const mapTx = (r: TxRow): Transaction => ({
  id: r.id, userId: r.user_id, type: r.type as Transaction["type"],
  description: r.description ?? "", amount: num(r.amount), category: r.category,
  account: (r.account as AccountType) ?? undefined,
  createdAt: r.created_at,
});
const mapLoan = (r: LoanRow): Loan => {
  const legacyLent = (r.lender_name ?? "").startsWith("[Lent]");
  return {
    id: r.id, userId: r.user_id,
    lenderName: r.lender_name, description: r.description ?? "",
    totalAmount: num(r.total_amount),
    direction: r.direction === "lent" || legacyLent ? "lent" : "borrowed",
    dueDate: r.due_date, createdAt: r.created_at,
  };
};
const mapPay = (r: PayRow): LoanPayment => ({
  id: r.id, loanId: r.loan_id, userId: r.user_id,
  amount: num(r.amount), note: r.note, paidAt: r.paid_at,
});
const mapRec = (r: RecRow): RecurringExpense => ({
  id: r.id, userId: r.user_id, name: r.name, amount: num(r.amount), category: r.category,
  dueDay: r.due_day, active: r.active, frequency: r.frequency,
  notes: r.notes, nextDueDate: r.next_due_date, paidTxId: r.paid_tx_id ?? null, createdAt: r.created_at,
});
const mapBud = (r: BudRow): BudgetGoal => ({
  id: r.id, userId: r.user_id, name: r.name, category: r.category,
  monthlyLimit: num(r.monthly_limit), createdAt: r.created_at,
});
const mapSav = (r: SavRow): SavingsGoal => ({
  id: r.id, userId: r.user_id, name: r.name,
  targetAmount: num(r.target_amount), currentAmount: num(r.current_amount),
  targetDate: r.target_date, createdAt: r.created_at,
});
const mapProfile = (r: ProfileRow): FinancialProfile => ({
  cashOnHand: num(r.cash_on_hand),
  bankBalance: num(r.bank_balance),
  savingsBalance: num(r.savings_balance),
  investments: num(r.investments),
  otherAssets: num(r.other_assets),
  totalDebts: num(r.total_debts),
  monthlyIncome: r.monthly_income != null ? num(r.monthly_income) : null,
  monthlyExpenses: r.monthly_expenses != null ? num(r.monthly_expenses) : null,
  savingsGoal: r.savings_goal != null ? num(r.savings_goal) : null,
  updatedAt: r.updated_at,
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function dbErr(label: string, e: { message?: string } | null | undefined): Error {
  const msg = e?.message ?? "Unknown error";
  if (/network|fetch/i.test(msg)) return new Error("No internet connection. Please try again.");
  return new Error(`${label}: ${msg}`);
}

/** Refresh both the data list and the balances after any change. */
function useRefresh() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: userFinanceKey(userId) }),
    qc.invalidateQueries({ queryKey: userProfileKey(userId) }),
  ]);
}

// ── Financial Profile (balances) ──────────────────────────────────────────────

export function useFinancialProfile() {
  const { isSignedIn, userId } = useAuth();
  return useQuery({
    queryKey: userProfileKey(userId),
    queryFn: async (): Promise<FinancialProfile | null> => {
      const { data, error } = await supabase
        .from("financial_profiles").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw dbErr("profile", error);
      return data ? mapProfile(data as ProfileRow) : null;
    },
    enabled: !!isSignedIn && !!userId,
    staleTime: 10_000,
  });
}

export function useUpsertFinancialProfile() {
  const { userId } = useAuth();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: {
      cashOnHand: number; bankBalance: number; savingsBalance: number;
      investments: number; otherAssets: number; totalDebts: number;
      monthlyIncome: number | null; monthlyExpenses: number | null; savingsGoal: number | null;
    }) => {
      const { error } = await supabase.from("financial_profiles").upsert({
        user_id: userId,
        cash_on_hand: d.cashOnHand, bank_balance: d.bankBalance, savings_balance: d.savingsBalance,
        investments: d.investments, other_assets: d.otherAssets, total_debts: d.totalDebts,
        monthly_income: d.monthlyIncome, monthly_expenses: d.monthlyExpenses,
        savings_goal: d.savingsGoal, updated_at: new Date().toISOString(),
      });
      if (error) throw dbErr("Could not save profile", error);
    },
    onSuccess: refresh,
  });
}

// ── Read all finance data ─────────────────────────────────────────────────────

export function useFinanceData() {
  const { isSignedIn, userId } = useAuth();
  return useQuery({
    queryKey: userFinanceKey(userId),
    queryFn: async (): Promise<AggregateData> => {
      const [txRes, loanRes, payRes, recRes, budRes, savRes] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(5000),
        supabase.from("loans").select("*").order("created_at", { ascending: false }),
        supabase.from("loan_payments").select("*").order("paid_at", { ascending: false }),
        supabase.from("recurring_expenses").select("*").order("created_at"),
        supabase.from("budget_goals").select("*").order("created_at"),
        supabase.from("savings_goals").select("*").order("created_at"),
      ]);

      if (txRes.error)   throw dbErr("transactions", txRes.error);
      if (loanRes.error) throw dbErr("loans", loanRes.error);
      if (payRes.error)  throw dbErr("loan payments", payRes.error);
      if (recRes.error)  throw dbErr("bills", recRes.error);
      if (budRes.error)  throw dbErr("budgets", budRes.error);
      if (savRes.error)  throw dbErr("savings goals", savRes.error);

      const payments = (payRes.data ?? []) as PayRow[];
      return {
        transactions: ((txRes.data ?? []) as TxRow[]).map(mapTx),
        loans: ((loanRes.data ?? []) as LoanRow[]).map((r) => ({
          ...mapLoan(r),
          payments: payments.filter((p) => p.loan_id === r.id).map(mapPay),
        })),
        recurring: ((recRes.data ?? []) as RecRow[]).map(mapRec),
        budgetGoals: ((budRes.data ?? []) as BudRow[]).map(mapBud),
        savingsGoals: ((savRes.data ?? []) as SavRow[]).map(mapSav),
      };
    },
    enabled: !!isSignedIn && !!userId,
    retry: 1,
    staleTime: 30_000,
  });
}

// ── Transactions ──────────────────────────────────────────────────────────────

type NewTx = Omit<Transaction, "id" | "userId" | "createdAt"> & { createdAt?: string };

export function useAddTransaction() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async (d: NewTx) => {
      // Budget alert check uses the data already on the phone (no extra download)
      if (d.type === "expense") {
        const cached = qc.getQueryData<AggregateData>(userFinanceKey(userId));
        const budget = cached?.budgetGoals.find((b) => b.category === d.category);
        if (cached && budget) {
          const key = monthKey(d.createdAt ?? new Date());
          const spentBefore = cached.transactions
            .filter((t) => t.type === "expense" && t.category === d.category && monthKey(t.createdAt) === key)
            .reduce((s, t) => s + t.amount, 0);
          const currency = (await AsyncStorage.getItem(`savify_${userId}_currency`).catch(() => null)) ?? "AED";
          notifyBudgetIfNeeded({ category: d.category, spentBefore, amount: Math.abs(d.amount), limit: budget.monthlyLimit, currency, monthKey: key }).catch(() => {});
        }
      }
      const { data, error } = await supabase.rpc("add_transaction", {
        p_type: d.type, p_description: d.description ?? "", p_amount: Math.abs(d.amount),
        p_category: d.category, p_account: d.account ?? null, p_created_at: d.createdAt ?? null,
      });
      if (error) throw dbErr("Could not add transaction", error);
      return mapTx(data as TxRow);
    },
    onSuccess: refresh,
  });
}

export function useUpdateTransaction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: NewTx & { id: string }) => {
      const { error } = await supabase.rpc("update_transaction", {
        p_id: d.id, p_type: d.type, p_description: d.description ?? "",
        p_amount: Math.abs(d.amount), p_category: d.category, p_account: d.account ?? null,
      });
      if (error) throw dbErr("Could not update transaction", error);
    },
    onSuccess: refresh,
  });
}

export function useDeleteTransaction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_transaction", { p_id: id });
      if (error) throw dbErr("Could not delete transaction", error);
    },
    onSuccess: refresh,
  });
}

// ── Loans ─────────────────────────────────────────────────────────────────────

export function useAddLoan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: Omit<Loan, "id" | "userId" | "createdAt" | "direction"> & {
      account?: AccountType; direction?: "borrowed" | "lent";
    }): Promise<{ id: string }> => {
      const { data, error } = await supabase.rpc("add_loan", {
        p_lender_name: d.lenderName.replace(/^\[(Lent|Borrowed)\]\s*/, ""),
        p_description: d.description ?? "", p_total_amount: Math.abs(d.totalAmount),
        p_direction: d.direction ?? "borrowed",
        p_due_date: d.dueDate ? d.dueDate.slice(0, 10) : null,
        p_account: d.account ?? null,
      });
      if (error || !data) throw dbErr("Could not add loan", error);
      return { id: (data as LoanRow).id };
    },
    onSuccess: refresh,
  });
}

export function useDeleteLoan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loans").delete().eq("id", id); // payments are removed automatically
      if (error) throw dbErr("Could not delete loan", error);
    },
    onSuccess: refresh,
  });
}

export function useAddLoanPayment() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ loanId, amount, note, account }: {
      loanId: string; amount: number; note?: string | null; account?: AccountType;
    }) => {
      const { error } = await supabase.rpc("add_loan_payment", {
        p_loan_id: loanId, p_amount: Math.abs(amount), p_note: note ?? null, p_account: account ?? null,
      });
      if (error) throw dbErr("Could not record payment", error);
    },
    onSuccess: refresh,
  });
}

// ── Savings Goals ─────────────────────────────────────────────────────────────

export function useAddSavingsGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: Omit<SavingsGoal, "id" | "userId" | "createdAt" | "currentAmount">) => {
      const { error } = await supabase.from("savings_goals").insert({
        name: d.name, target_amount: d.targetAmount, current_amount: 0,
        target_date: d.targetDate ? d.targetDate.slice(0, 10) : null,
      });
      if (error) throw dbErr("Could not add goal", error);
    },
    onSuccess: refresh,
  });
}

export function useDeleteSavingsGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_goals").delete().eq("id", id);
      if (error) throw dbErr("Could not delete goal", error);
    },
    onSuccess: refresh,
  });
}

export function useContributeSavingsGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, amount, account }: { id: string; amount: number; account?: AccountType }) => {
      const { error } = await supabase.rpc("contribute_savings_goal", {
        p_id: id, p_amount: amount, p_account: account ?? null,
      });
      if (error) throw dbErr("Could not add to goal", error);
    },
    onSuccess: refresh,
  });
}

// ── Budget Goals ──────────────────────────────────────────────────────────────

export function useAddBudgetGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: Omit<BudgetGoal, "id" | "userId" | "createdAt">) => {
      const { error } = await supabase.from("budget_goals").insert({
        name: d.name ?? d.category, category: d.category, monthly_limit: d.monthlyLimit,
      });
      if (error) throw dbErr("Could not add budget", error);
    },
    onSuccess: refresh,
  });
}

export function useUpdateBudgetGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, monthlyLimit }: { id: string; monthlyLimit: number }) => {
      const { error } = await supabase.from("budget_goals").update({ monthly_limit: monthlyLimit }).eq("id", id);
      if (error) throw dbErr("Could not update budget", error);
    },
    onSuccess: refresh,
  });
}

export function useDeleteBudgetGoal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_goals").delete().eq("id", id);
      if (error) throw dbErr("Could not delete budget", error);
    },
    onSuccess: refresh,
  });
}

// ── Recurring bills ───────────────────────────────────────────────────────────

export function useAddRecurring() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (d: {
      name: string; amount: number; category: string; dueDay: number;
      active: boolean; frequency?: string; notes?: string | null; nextDueDate?: string | null;
    }) => {
      const { data, error } = await supabase.from("recurring_expenses").insert({
        name: d.name, amount: d.amount, category: d.category,
        due_day: Math.min(31, Math.max(1, Math.round(d.dueDay))), active: d.active ?? true,
        frequency: d.frequency ?? "monthly",
        notes: d.notes ?? null, next_due_date: d.nextDueDate ? d.nextDueDate.slice(0, 10) : null,
      }).select().single();
      if (error) throw dbErr("Could not add bill", error);
      return mapRec(data as RecRow);
    },
    onSuccess: refresh,
  });
}

export function useToggleRecurring() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: row, error: fetchErr } = await supabase
        .from("recurring_expenses").select("active").eq("id", id).single();
      if (fetchErr || !row) throw dbErr("Could not update bill", fetchErr);
      const { error } = await supabase.from("recurring_expenses").update({ active: !row.active }).eq("id", id);
      if (error) throw dbErr("Could not update bill", error);
    },
    onSuccess: refresh,
  });
}

export function useDeleteRecurring() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw dbErr("Could not delete bill", error);
    },
    onSuccess: refresh,
  });
}

/** Mark a bill as paid: records the expense, takes it from the chosen account, moves the due date. */
export function usePayRecurring() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (arg: string | { id: string; account?: AccountType }) => {
      const id = typeof arg === "string" ? arg : arg.id;
      const account = typeof arg === "string" ? null : arg.account ?? null;
      const { data, error } = await supabase.rpc("pay_bill", { p_id: id, p_account: account });
      if (error || !data) throw dbErr("Could not record payment", error);
      const res = data as { transaction: TxRow; nextDueDate: string };
      return { transaction: mapTx(res.transaction), nextDueDate: res.nextDueDate };
    },
    onSuccess: refresh,
  });
}

// ── Generate Test Data ────────────────────────────────────────────────────────

const TEST_SEED: Partial<AggregateData> = (() => {
  const today = new Date();
  const d = (monthsBack: number, day: number) => {
    const dt = new Date(today.getFullYear(), today.getMonth() - monthsBack, day);
    return dt.toISOString();
  };
  const transactions: Omit<Transaction, "id" | "userId">[] = [
    // ── Month 5 ──
    { type: "income",  description: "Monthly Salary",        amount: 11000, category: "Salary",         createdAt: d(5, 1)  },
    { type: "expense", description: "Supermarket Groceries", amount: 590,   category: "Food & Dining",  createdAt: d(5, 4)  },
    { type: "expense", description: "Petrol",                amount: 195,   category: "Transportation", createdAt: d(5, 7)  },
    { type: "expense", description: "Electricity Bill",      amount: 360,   category: "Utilities",      createdAt: d(5, 11) },
    { type: "expense", description: "Gym Membership",        amount: 299,   category: "Healthcare",     createdAt: d(5, 2)  },
    { type: "expense", description: "Clothes Shopping",      amount: 380,   category: "Shopping",       createdAt: d(5, 18) },
    // ── Month 4 ──
    { type: "income",  description: "Monthly Salary",        amount: 11500, category: "Salary",         createdAt: d(4, 1)  },
    { type: "income",  description: "Investment Returns",    amount: 800,   category: "Investment",     createdAt: d(4, 10) },
    { type: "expense", description: "Supermarket Groceries", amount: 610,   category: "Food & Dining",  createdAt: d(4, 3)  },
    { type: "expense", description: "Restaurant",            amount: 150,   category: "Food & Dining",  createdAt: d(4, 17) },
    { type: "expense", description: "Petrol",                amount: 175,   category: "Transportation", createdAt: d(4, 8)  },
    { type: "expense", description: "Water & AC Bill",       amount: 260,   category: "Utilities",      createdAt: d(4, 12) },
    { type: "expense", description: "Gym Membership",        amount: 299,   category: "Healthcare",     createdAt: d(4, 2)  },
    { type: "expense", description: "Online Shopping",       amount: 290,   category: "Shopping",       createdAt: d(4, 21) },
    // ── Month 3 ──
    { type: "income",  description: "Monthly Salary",        amount: 12000, category: "Salary",         createdAt: d(3, 1)  },
    { type: "expense", description: "Groceries",             amount: 560,   category: "Food & Dining",  createdAt: d(3, 5)  },
    { type: "expense", description: "Uber Rides",            amount: 190,   category: "Transportation", createdAt: d(3, 9)  },
    { type: "expense", description: "Internet + Phone",      amount: 249,   category: "Utilities",      createdAt: d(3, 10) },
    { type: "expense", description: "Gym Membership",        amount: 299,   category: "Healthcare",     createdAt: d(3, 2)  },
    { type: "expense", description: "Weekend Trip",          amount: 650,   category: "Travel",         createdAt: d(3, 22) },
    { type: "expense", description: "Online Shopping",       amount: 320,   category: "Shopping",       createdAt: d(3, 18) },
    // ── Month 2 ──
    { type: "income",  description: "Monthly Salary",        amount: 12000, category: "Salary",         createdAt: d(2, 1)  },
    { type: "income",  description: "Freelance Project",     amount: 2500,  category: "Freelance",      createdAt: d(2, 15) },
    { type: "expense", description: "Supermarket Groceries", amount: 620,   category: "Food & Dining",  createdAt: d(2, 5)  },
    { type: "expense", description: "Restaurant Dinner",     amount: 180,   category: "Food & Dining",  createdAt: d(2, 10) },
    { type: "expense", description: "Uber Rides",            amount: 210,   category: "Transportation", createdAt: d(2, 8)  },
    { type: "expense", description: "Petrol",                amount: 180,   category: "Transportation", createdAt: d(2, 20) },
    { type: "expense", description: "Electricity Bill",      amount: 340,   category: "Utilities",      createdAt: d(2, 12) },
    { type: "expense", description: "Netflix + Streaming",   amount: 89,    category: "Entertainment",  createdAt: d(2, 3)  },
    { type: "expense", description: "Gym Membership",        amount: 299,   category: "Healthcare",     createdAt: d(2, 2)  },
    { type: "expense", description: "Clothes Shopping",      amount: 450,   category: "Shopping",       createdAt: d(2, 14) },
    // ── Month 1 ──
    { type: "income",  description: "Monthly Salary",        amount: 12000, category: "Salary",         createdAt: d(1, 1)  },
    { type: "income",  description: "Freelance Design Work", amount: 1800,  category: "Freelance",      createdAt: d(1, 20) },
    { type: "expense", description: "Supermarket Groceries", amount: 580,   category: "Food & Dining",  createdAt: d(1, 4)  },
    { type: "expense", description: "Petrol + Car Wash",     amount: 200,   category: "Transportation", createdAt: d(1, 6)  },
    { type: "expense", description: "Water & AC Bill",       amount: 280,   category: "Utilities",      createdAt: d(1, 11) },
    { type: "expense", description: "Gym Membership",        amount: 299,   category: "Healthcare",     createdAt: d(1, 2)  },
    { type: "expense", description: "Weekend Trip Hotel",    amount: 780,   category: "Travel",         createdAt: d(1, 28) },
    // ── Current month ──
    { type: "income",  description: "Monthly Salary",        amount: 12000, category: "Salary",         createdAt: d(0, 1)  },
    { type: "expense", description: "Groceries",             amount: 540,   category: "Food & Dining",  createdAt: d(0, 3)  },
    { type: "expense", description: "Petrol",                amount: 185,   category: "Transportation", createdAt: d(0, 7)  },
    { type: "expense", description: "Internet + Phone",      amount: 249,   category: "Utilities",      createdAt: d(0, 10) },
    { type: "expense", description: "Online Shopping",       amount: 265,   category: "Shopping",       createdAt: d(0, 5)  },
  ];
  const savingsGoals: Omit<SavingsGoal, "id" | "userId">[] = [
    { name: "Emergency Fund 🛡️",  targetAmount: 30000, currentAmount: 8500,  targetDate: null, createdAt: d(2, 1) },
    { name: "Vacation ✈️",        targetAmount: 10000, currentAmount: 3200,  targetDate: new Date(today.getFullYear(), today.getMonth() + 6, 1).toISOString().split("T")[0] + "T00:00:00.000Z", createdAt: d(1, 1) },
    { name: "New MacBook 💻",     targetAmount: 6000,  currentAmount: 1500,  targetDate: new Date(today.getFullYear(), today.getMonth() + 3, 1).toISOString().split("T")[0] + "T00:00:00.000Z", createdAt: d(0, 5) },
  ];
  const budgetGoals: Omit<BudgetGoal, "id" | "userId">[] = [
    { name: "Food & Dining",   category: "Food & Dining",   monthlyLimit: 1200, createdAt: d(2, 1) },
    { name: "Transportation",  category: "Transportation",  monthlyLimit: 600,  createdAt: d(2, 1) },
    { name: "Entertainment",   category: "Entertainment",   monthlyLimit: 400,  createdAt: d(2, 1) },
    { name: "Shopping",        category: "Shopping",        monthlyLimit: 800,  createdAt: d(2, 1) },
  ];
  const recurring: Omit<RecurringExpense, "id" | "userId">[] = [
    { name: "Netflix",         amount: 54,   category: "Entertainment", dueDay: 3,  active: true, frequency: "monthly", notes: null, nextDueDate: null, createdAt: d(2, 1) },
    { name: "Gym Membership",  amount: 299,  category: "Healthcare",    dueDay: 2,  active: true, frequency: "monthly", notes: null, nextDueDate: null, createdAt: d(2, 1) },
    { name: "Phone Bill",      amount: 149,  category: "Utilities",     dueDay: 10, active: true, frequency: "monthly", notes: null, nextDueDate: null, createdAt: d(2, 1) },
    { name: "Internet (Home)", amount: 199,  category: "Utilities",     dueDay: 15, active: true, frequency: "monthly", notes: null, nextDueDate: null, createdAt: d(2, 1) },
    { name: "Spotify",         amount: 29,   category: "Entertainment", dueDay: 5,  active: true, frequency: "monthly", notes: null, nextDueDate: null, createdAt: d(2, 1) },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loans: any[] = [
    {
      lenderName: "Bank Car Finance", description: "Car loan", direction: "borrowed",
      totalAmount: 55000, dueDate: new Date(today.getFullYear() + 3, today.getMonth(), 1).toISOString().split("T")[0] + "T00:00:00.000Z",
      createdAt: d(2, 1),
      payments: [
        { amount: 1100, note: "Monthly instalment", paidAt: d(2, 5) },
        { amount: 1100, note: "Monthly instalment", paidAt: d(1, 5) },
        { amount: 1100, note: "Monthly instalment", paidAt: d(0, 5) },
      ],
    },
  ];
  return { transactions: transactions as Transaction[], savingsGoals: savingsGoals as SavingsGoal[], budgetGoals: budgetGoals as BudgetGoal[], recurring: recurring as RecurringExpense[], loans };
})();

const TEST_FINANCIAL_PROFILE = {
  cashOnHand: 2500,
  bankBalance: 18000,
  savingsBalance: 8500,
  investments: 15000,
  otherAssets: 0,
  totalDebts: 52800,
  monthlyIncome: 12000,
  monthlyExpenses: 2800,
  savingsGoal: 5000,
};




export function useGenerateTestData() {
  const importData = useImportData();
  const upsertProfile = useUpsertFinancialProfile();
  return {
    isPending: importData.isPending || upsertProfile.isPending,
    mutateAsync: async () => {
      await importData.mutateAsync(TEST_SEED);
      await upsertProfile.mutateAsync(TEST_FINANCIAL_PROFILE);
    },
  };
}

// ── Bulk operations ───────────────────────────────────────────────────────────

/** Delete all my transactions, loans, bills, budgets and goals (keeps the account). */
export function useResetData() {
  const qc = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reset_my_data");
      if (error) throw dbErr("Could not reset data", error);
      await supabase.from("financial_profiles").delete().eq("user_id", userId!);
    },
    onSuccess: () => Promise.all([
      qc.resetQueries({ queryKey: userFinanceKey(userId) }),
      qc.resetQueries({ queryKey: userProfileKey(userId) }),
    ]),
  });
}

/** Replace all my data with a backup. If anything fails, NOTHING is changed. */
export function useImportData() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (data: Partial<AggregateData>) => {
      const { error } = await supabase.rpc("import_my_data", { p: data });
      if (error) throw dbErr("Could not import data", error);
    },
    onSuccess: refresh,
  });
}
