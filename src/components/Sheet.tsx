import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

export function Sheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: ComponentChildren;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label="關閉">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
