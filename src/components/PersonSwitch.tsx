import { useEffect, useMemo, useState } from 'preact/hooks';
import { listCategories } from '../api';
import { useApp } from '../context';
import type { Category, Person } from '../types';

/** Me first, then everyone who shares their ledger with me. */
export function usePeople(): Person[] {
  const { me, sharing } = useApp();
  return useMemo(() => [{ id: me, name: '我' }, ...sharing.canView], [me, sharing]);
}

/** Categories of whichever person is being viewed (own ones come from context). */
export function usePersonCategories(personId: string): { list: Category[]; byId: Map<string, Category> } | null {
  const { me, categories, byId } = useApp();
  const [other, setOther] = useState<Category[] | null>(null);
  useEffect(() => {
    if (personId === me) return;
    let alive = true;
    setOther(null);
    listCategories(personId).then((c) => alive && setOther(c)).catch(() => alive && setOther([]));
    return () => { alive = false; };
  }, [personId, me]);
  const list = personId === me ? categories : other;
  return useMemo(
    () => (list ? { list, byId: personId === me ? byId : new Map(list.map((c) => [c.id, c])) } : null),
    [list, byId, personId, me],
  );
}

export function PersonSwitch({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const people = usePeople();
  if (people.length < 2) return null;
  return (
    <div class="segmented person-switch" role="tablist" aria-label="檢視誰的帳"
      style={{ gridTemplateColumns: `repeat(${people.length}, 1fr)` }}>
      {people.map((p) => (
        <button key={p.id} role="tab" aria-selected={value === p.id} class={value === p.id ? 'on' : ''}
          onClick={() => onChange(p.id)}>{p.name}</button>
      ))}
    </div>
  );
}
