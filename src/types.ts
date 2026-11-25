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
  amount: number;
  category_id: string;
  note: string | null;
  spent_on: string; // YYYY-MM-DD
  created_at: string;
  latitude: number | null;
  longitude: number | null;
};

export type ExpenseInput = {
  amount: number;
  category_id: string;
  note: string | null;
  spent_on: string;
};
