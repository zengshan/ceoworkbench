'use client';

import type { StageClusterConnection, StageFocusId } from '@/features/workbench/types';

type StageConnectorLayerProps = {
  connectors: StageClusterConnection[];
  anchors: Record<StageFocusId, { x: number; y: number }>;
  height: number;
  width: number;
};

export function StageConnectorLayer({ connectors, anchors, height, width }: StageConnectorLayerProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {connectors.map((connector) => {
        const from = anchors[connector.fromClusterId];
        const to = anchors[connector.toClusterId];

        if (!from || !to) {
          return null;
        }

        const midX = (from.x + to.x) / 2;
        const labelX = midX;
        const labelY = (from.y + to.y) / 2;

        return (
          <g key={connector.id}>
            <path
              d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
              fill="none"
              stroke="rgba(64,44,22,0.22)"
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            {connector.label ? (
              <g transform={`translate(${labelX}, ${labelY})`}>
                <rect
                  x="-30"
                  y="-11"
                  width="60"
                  height="22"
                  rx="11"
                  fill="rgba(255,255,255,0.92)"
                  stroke="rgba(32,23,15,0.08)"
                />
                <text
                  fill="rgba(87,72,56,0.86)"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {connector.label}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
