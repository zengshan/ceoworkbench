'use client';

import clsx from 'clsx';
import type { StageLayer, StageLayerId } from '@/features/workbench/types';

type StageLayerSwitcherProps = {
  layers: StageLayer[];
  activeLayerId: StageLayerId;
  onChange: (layerId: StageLayerId) => void;
};

export function StageLayerSwitcher({ layers, activeLayerId, onChange }: StageLayerSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[22px] border border-[var(--line)] bg-white/72 p-2">
      {layers.map((layer) => {
        const isActive = layer.id === activeLayerId;

        return (
          <button
            key={layer.id}
            type="button"
            aria-label={layer.label}
            aria-pressed={isActive}
            onClick={() => onChange(layer.id)}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-medium transition',
              isActive
                ? 'border-[rgba(31,122,97,0.24)] bg-[rgba(31,122,97,0.12)] text-[var(--accent)]'
                : 'border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-white/82',
            )}
          >
            {layer.label}
          </button>
        );
      })}
    </div>
  );
}
