'use client';

import clsx from 'clsx';
import type { StageCluster as StageClusterRecord, StageClusterLayout, StageFocusId } from '@/features/workbench/types';
import { StageCard } from './stage-card';

type StageClusterProps = {
  cluster: StageClusterRecord;
  layout: StageClusterLayout;
  focusState: 'active' | 'background';
  selectedCardId: string | null;
  onFocus: (focusId: StageFocusId) => void;
  onSelectCard: (clusterId: StageFocusId, cardId: string) => void;
};

export function StageCluster({ cluster, layout, focusState, selectedCardId, onFocus, onSelectCard }: StageClusterProps) {
  return (
    <div
      className={clsx(
        'absolute transition-all duration-300 ease-out',
        focusState === 'background' ? 'scale-[0.985]' : 'scale-100',
      )}
      style={{ left: layout.x, top: layout.y, width: layout.w, zIndex: layout.z }}
      data-cluster={cluster.id}
      data-mode={layout.mode}
      data-focus-state={focusState}
      data-testid={`cluster-${cluster.id}`}
    >
      {focusState === 'active' ? (
        <div className="pointer-events-none absolute inset-[-16px] -z-10 rounded-[34px] bg-[radial-gradient(circle_at_top,rgba(31,122,97,0.12),rgba(31,122,97,0.02)_58%,transparent_78%)] blur-sm" />
      ) : null}
      <button
        type="button"
        onClick={() => onFocus(cluster.id)}
        className={clsx(
          'mb-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition',
          focusState === 'active'
            ? 'bg-[rgba(31,122,97,0.14)] text-[var(--accent)] shadow-[0_10px_24px_rgba(31,122,97,0.12)]'
            : 'bg-[rgba(255,255,255,0.76)] text-[rgba(109,95,79,0.9)] hover:bg-white hover:text-[var(--text)]',
        )}
      >
        {cluster.label}
      </button>
      <div
        className={clsx(
          layout.mode === 'focused' ? 'space-y-3' : 'space-y-2',
          focusState === 'background' && 'opacity-60 saturate-[0.76] [filter:grayscale(0.16)]',
        )}
      >
        {cluster.cards.map((card) => (
          <StageCard
            key={card.id}
            card={card}
            mode={layout.mode}
            focusState={focusState}
            selected={card.id === selectedCardId}
            onSelect={() => onSelectCard(cluster.id, card.id)}
          />
        ))}
      </div>
    </div>
  );
}
