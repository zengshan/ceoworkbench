'use client';

import clsx from 'clsx';
import type { StageCluster, StageFocusId } from '@/features/workbench/types';

type StageLayerSwitcherProps = {
  clusters: StageCluster[];
  focusOrder: StageFocusId[];
  activeFocusId: StageFocusId;
  onChange: (focusId: StageFocusId) => void;
};

export function StageLayerSwitcher({ clusters, focusOrder, activeFocusId, onChange }: StageLayerSwitcherProps) {
  const clusterById = Object.fromEntries(clusters.map((cluster) => [cluster.id, cluster])) as Record<StageFocusId, StageCluster>;

  return (
    <div className="flex flex-wrap gap-2 rounded-[22px] border border-[var(--line)] bg-white/72 p-2">
      {focusOrder.map((focusId) => {
        const cluster = clusterById[focusId];
        const isActive = focusId === activeFocusId;

        return (
          <button
            key={focusId}
            type="button"
            aria-label={cluster.switcherLabel}
            aria-pressed={isActive}
            onClick={() => onChange(focusId)}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'border-[rgba(31,122,97,0.24)] bg-[rgba(31,122,97,0.12)] text-[var(--accent)]'
                : 'border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-white/82',
            )}
          >
            {cluster.switcherLabel}
          </button>
        );
      })}
    </div>
  );
}
