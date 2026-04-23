import clsx from 'clsx';

type PillTone = 'neutral' | 'accent' | 'warning' | 'danger';

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.04em]',
        tone === 'accent' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
        tone === 'warning' && 'bg-[rgba(182,90,40,0.12)] text-[var(--warning)]',
        tone === 'danger' && 'bg-[rgba(158,59,47,0.12)] text-[var(--danger)]',
        tone === 'neutral' && 'bg-[rgba(32,23,15,0.06)] text-[var(--muted)]',
      )}
    >
      {label}
    </span>
  );
}
