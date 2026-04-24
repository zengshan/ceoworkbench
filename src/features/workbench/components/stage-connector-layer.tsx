'use client';

import type { RenderedConnector } from '@/features/workbench/stage-geometry';

type StageConnectorLayerProps = {
  connectors: RenderedConnector[];
  height: number;
  width: number;
};

export function StageConnectorLayer({ connectors, height, width }: StageConnectorLayerProps) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0"
      data-testid="stage-connector-canvas"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
    >
      {connectors.map((connector) => {
        return (
          <g
            key={connector.id}
            data-testid={`connector-${connector.id}`}
            data-from-card-id={connector.fromCardId}
            data-to-card-id={connector.toCardId}
          >
            <path
              d={connector.path}
              fill="none"
              stroke={connector.isActive ? 'rgba(31,122,97,0.16)' : 'rgba(94,79,60,0.08)'}
              strokeLinecap="round"
              strokeWidth={connector.isActive ? '8' : '4'}
            />
            <path
              d={connector.path}
              fill="none"
              stroke={connector.isActive ? 'rgba(22,101,79,0.78)' : 'rgba(106,90,68,0.34)'}
              strokeLinecap="round"
              strokeWidth={connector.isActive ? '3.2' : '1.8'}
            />
            {connector.label ? (
              <g transform={`translate(${connector.labelX}, ${connector.labelY})`}>
                <rect
                  x="-34"
                  y="-12"
                  width="68"
                  height="24"
                  rx="12"
                  fill={connector.isActive ? 'rgba(247,253,250,0.98)' : 'rgba(255,252,246,0.94)'}
                  stroke={connector.isActive ? 'rgba(31,122,97,0.18)' : 'rgba(94,79,60,0.12)'}
                />
                <text
                  fill={connector.isActive ? 'rgba(22,101,79,0.92)' : 'rgba(109,95,79,0.78)'}
                  fontSize="10.5"
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
