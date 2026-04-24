'use client';

import clsx from 'clsx';
import type { StageClusterCardRecord, StageClusterLayout } from '@/features/workbench/types';

type StageCardProps = {
  card: StageClusterCardRecord;
  mode: StageClusterLayout['mode'];
  selected: boolean;
  onSelect: () => void;
};

const toneClassNames: Record<NonNullable<StageClusterCardRecord['tone']>, string> = {
  paper: 'border-[rgba(74,58,39,0.12)] bg-[rgba(255,252,245,0.94)]',
  accent: 'border-[rgba(31,122,97,0.22)] bg-[linear-gradient(160deg,rgba(236,248,244,0.96),rgba(255,255,255,0.94))]',
  warning: 'border-[rgba(182,90,40,0.22)] bg-[linear-gradient(160deg,rgba(255,244,236,0.96),rgba(255,255,255,0.94))]',
};

export function StageCard({ card, mode, selected, onSelect }: StageCardProps) {
  const tone = card.tone ?? 'paper';
  const compact = mode === 'compressed';
  const supporting = mode === 'supporting';

  return (
    <button
      type="button"
      aria-label={card.title}
      aria-pressed={selected}
      onClick={onSelect}
      className={clsx(
        'w-full rounded-[26px] border text-left transition',
        toneClassNames[tone],
        compact
          ? 'p-3 shadow-[0_10px_22px_rgba(58,42,24,0.05)]'
          : supporting
            ? 'p-4 shadow-[0_16px_30px_rgba(58,42,24,0.07)]'
            : 'p-5 shadow-[0_22px_40px_rgba(58,42,24,0.08)]',
        selected
          ? 'border-[rgba(31,122,97,0.34)] ring-2 ring-[rgba(31,122,97,0.16)]'
          : 'hover:-translate-y-0.5 hover:shadow-[0_24px_42px_rgba(58,42,24,0.12)]',
      )}
      style={{ transform: `rotate(${card.rotation ?? 0}deg)` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={clsx(
            'rounded-full bg-[rgba(32,23,15,0.06)] font-semibold text-[var(--muted)]',
            compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]',
          )}
        >
          {card.statusLabel ?? '工作卡'}
        </div>
        <div className={clsx('text-[var(--muted)]', compact ? 'text-[10px]' : 'text-xs')}>{card.updatedAt}</div>
      </div>
      <div className={clsx(compact ? 'mt-2' : 'mt-4')}>
        <div className={clsx('font-semibold', compact ? 'text-sm leading-5' : 'text-lg leading-7')}>{card.title}</div>
        {compact ? null : (
          <p className={clsx('text-[var(--muted)]', supporting ? 'mt-2 text-[13px] leading-5' : 'mt-3 text-sm leading-6')}>
            {card.body}
          </p>
        )}
      </div>
      {compact ? null : (
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
      )}
      {compact ? (
        <div className="mt-3 text-[11px] font-medium text-[var(--muted)]">{card.owner}</div>
      ) : null}
    </button>
  );
}
