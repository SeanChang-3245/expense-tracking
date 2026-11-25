import { deleteExpense, updateExpense } from '../api';
import { useApp } from '../context';
import type { Expense } from '../types';
import { ExpenseForm } from './ExpenseForm';
import { Sheet } from './Sheet';

/** Edit or delete one expense; calls onDone after a successful change. */
export function EditExpenseSheet({ expense, onClose, onDone }: {
  expense: Expense; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useApp();
  return (
    <Sheet title="編輯記錄" onClose={onClose}>
      <ExpenseForm
        initial={expense}
        submitLabel="儲存"
        onSubmit={async (v) => {
          try { await updateExpense(expense.id, v); }
          catch (e) { toast(`儲存失敗：${(e as Error).message}`); throw e; }
          toast('已更新');
          onClose();
          onDone();
        }}
        onDelete={async () => {
          try { await deleteExpense(expense.id); }
          catch (e) { toast(`刪除失敗：${(e as Error).message}`); throw e; }
          toast('已刪除');
          onClose();
          onDone();
        }}
      />
    </Sheet>
  );
}
