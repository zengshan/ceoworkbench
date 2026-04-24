'use client';

import clsx from 'clsx';
import type { StageCluster as StageClusterRecord, StageClusterLayout, StageFocusId } from '@/features/workbench/types';
import { StageCard } from './stage-card';

type StageClusterProps = {
  cluster: StageClusterRecord;
  layout: StageClusterLayout;
  selectedCardId: string | null;
  onFocus: (focusId: StageFocusId) => void;
  onSelectCard: (clusterId: StageFocusId, cardId: string) => void;
};

export function StageCluster({ cluster, layout, selectedCardId, onFocus, onSelectCard }: StageClusterProps) {
  return (
    <div
      className="absolute transition-all duration-300 ease-out"
      style={{ left: layout.x, top: layout.y, width: layout.w, zIndex: layout.z }}
      data-cluster={cluster.id}
      data-mode={layout.mode}
      data-testid={`cluster-${cluster.id}`}
    >
      <button
        type="button"
        onClick={() => onFocus(cluster.id)}
        className={clsx(
          'mb-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition',
          layout.mode === 'focused'
            ? 'bg-[rgba(31,122,97,0.12)] text-[var(--accent)]'
            : 'bg-white/72 text-[var(--muted)] hover:bg-white hover:text-[var(--text)]',
        )}
      >
        {cluster.label}
      </button>
      <div className={clsx(layout.mode === 'focused' ? 'space-y-3' : 'space-y-2')}>
        {cluster.cards.map((card) => (
          <StageCard
            key={card.id}
            card={card}
            mode={layout.mode}
            selected={card.id === selectedCardId}
            onSelect={() => onSelectCard(cluster.id, card.id)}
          />
        ))}
      </div>
    </div>
  );
}
