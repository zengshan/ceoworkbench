'use client';

type WorkspaceFabProps = {
  unreadCount: number;
  open: boolean;
  onClick: () => void;
};

export function WorkspaceFab({ unreadCount, open, onClick }: WorkspaceFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="workspace-fab"
      aria-label="工作区"
      aria-pressed={open}
      className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-3 rounded-full border border-[rgba(31,122,97,0.18)] bg-white/96 px-5 py-3 text-sm font-semibold text-[var(--text)] shadow-[0_24px_60px_rgba(42,31,16,0.16)] backdrop-blur transition hover:-translate-y-0.5"
    >
      <span>工作区</span>
      {unreadCount > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--danger)] px-2 py-0.5 text-[11px] font-semibold text-white">
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}
