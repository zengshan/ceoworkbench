'use client';

import clsx from 'clsx';
import type { StageCardRecord } from '@/features/workbench/types';

type StageCardProps = {
  card: StageCardRecord;
  selected: boolean;
  onSelect: (cardId: string) => void;
};

const toneClassNames: Record<NonNullable<StageCardRecord['tone']>, string> = {
  paper: 'border-[rgba(74,58,39,0.12)] bg-[rgba(255,252,245,0.94)]',
  accent: 'border-[rgba(31,122,97,0.22)] bg-[linear-gradient(160deg,rgba(236,248,244,0.96),rgba(255,255,255,0.94))]',
  warning: 'border-[rgba(182,90,40,0.22)] bg-[linear-gradient(160deg,rgba(255,244,236,0.96),rgba(255,255,255,0.94))]',
};

export function StageCard({ card, selected, onSelect }: StageCardProps) {
  const tone = card.tone ?? 'paper';

  return (
    <button
      type="button"
      aria-label={card.title}
      aria-pressed={selected}
      onClick={() => onSelect(card.id)}
      className={clsx(
        'absolute rounded-[28px] border p-5 text-left shadow-[0_22px_40px_rgba(58,42,24,0.08)] transition',
        toneClassNames[tone],
        selected
          ? 'z-20 border-[rgba(31,122,97,0.34)] ring-2 ring-[rgba(31,122,97,0.16)]'
          : 'z-10 hover:-translate-y-0.5 hover:shadow-[0_28px_48px_rgba(58,42,24,0.12)]',
      )}
      style={{
        left: card.position.x,
        top: card.position.y,
        width: card.position.w,
        transform: `rotate(${card.rotation ?? 0}deg)`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-full bg-[rgba(32,23,15,0.06)] px-3 py-1 text-[11px] font-semibold text-[var(--muted)]">
          {card.statusLabel ?? '工作卡'}
        </div>
        <div className="text-xs text-[var(--muted)]">{card.updatedAt}</div>
      </div>
      <div className="mt-4">
        <div className="text-lg font-semibold leading-7">{card.title}</div>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.body}</p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">负责人</div>
          <div className="mt-1 text-sm font-medium">{card.owner}</div>
        </div>
        {card.artifactLabels?.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {card.artifactLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-[rgba(32,23,15,0.08)] bg-white/78 px-3 py-1 text-[11px] font-medium text-[var(--muted)]"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
