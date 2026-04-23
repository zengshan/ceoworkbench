import clsx from 'clsx';

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        'rounded-[28px] border border-[var(--line)] bg-[var(--panel)] shadow-[var(--shadow)] backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </section>
  );
}
