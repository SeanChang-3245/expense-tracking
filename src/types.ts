export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: number; // palette slot 1–8
  sort_order: number;
  archived: boolean;
};

export type Expense = {
  id: string;
  user_id: string;
  amount: number;
  category_id: string;
  note: string | null;
  spent_on: string; // YYYY-MM-DD
  private: boolean;
  created_at: string;
};

export type ExpenseInput = {
  amount: number;
  category_id: string;
  note: string | null;
  spent_on: string;
  private: boolean;
};

export type Person = { id: string; name: string };

export type Streak = { current: number; longest: number; loggedToday: boolean };
