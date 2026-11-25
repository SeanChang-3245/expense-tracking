export const Dot = ({ color }: { color: number }) => (
  <span class="dot" style={{ background: `var(--c${color})` }} aria-hidden="true" />
);
