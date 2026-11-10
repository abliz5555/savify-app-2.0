export type AccountType = "cash" | "bank" | "savings";

export type Transaction = {
  id: string;
  userId: string;
  type: "income" | "expense" | "savings";
  description: string;
  amount: number;
  category: string;
  account?: AccountType;
  createdAt: string;
};

export type LoanPayment = {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  note: string | null;
  paidAt: string;
};

export type Loan = {
  id: string;
  userId: string;
  lenderName: string;
  description: string;
  totalAmount: number;
  /** "borrowed" = you owe someone · "lent" = someone owes you */
  direction: "borrowed" | "lent";
  dueDate: string | null;
  createdAt: string;
  payments?: LoanPayment[];
};

export type RecurringExpense = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: string;
  dueDay: number;
  active: boolean;
  createdAt: string;
  frequency: string;
  notes: string | null;
  nextDueDate: string | null;
  /** id of the expense created when this bill was last marked paid */
  paidTxId?: string | null;
};

export type BudgetGoal = {
  id: string;
  userId: string;
  name: string;
  category: string;
  monthlyLimit: number;
  createdAt: string;
};

export type SavingsGoal = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  createdAt: string;
};

export type AggregateData = {
  transactions: Transaction[];
  loans: Loan[];
  recurring: RecurringExpense[];
  budgetGoals: BudgetGoal[];
  savingsGoals: SavingsGoal[];
};

export type FinancialProfile = {
  cashOnHand: number;
  bankBalance: number;
  savingsBalance: number;
  investments: number;
  otherAssets: number;
  totalDebts: number;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  savingsGoal: number | null;
  updatedAt: string;
};
