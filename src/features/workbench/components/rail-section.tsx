export function RailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
