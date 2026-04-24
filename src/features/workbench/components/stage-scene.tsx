'use client';

import type { StageCardRecord, StageConnection, StageLayer } from '@/features/workbench/types';
import { StageCard } from './stage-card';

type StageSceneProps = {
  layer: StageLayer;
  selectedCardId: string | null;
  onSelect: (cardId: string) => void;
};

function estimateCardHeight(card: StageCardRecord) {
  const artifactRows = Math.ceil((card.artifactLabels?.length ?? 0) / 2);

  return 188 + artifactRows * 28;
}

function buildConnectorPath(fromCard: StageCardRecord, toCard: StageCardRecord) {
  const fromX = fromCard.position.x + fromCard.position.w;
  const fromY = fromCard.position.y + estimateCardHeight(fromCard) / 2;
  const toX = toCard.position.x;
  const toY = toCard.position.y + estimateCardHeight(toCard) / 2;
  const curveOffset = Math.max(88, (toX - fromX) / 2);

  return `M ${fromX} ${fromY} C ${fromX + curveOffset} ${fromY}, ${toX - curveOffset} ${toY}, ${toX} ${toY}`;
}

function buildConnectionLabel(connection: StageConnection, fromCard: StageCardRecord, toCard: StageCardRecord) {
  return {
    id: connection.id,
    x: (fromCard.position.x + fromCard.position.w + toCard.position.x) / 2,
    y: (fromCard.position.y + toCard.position.y) / 2,
    text: connection.label,
  };
}

export function StageScene({ layer, selectedCardId, onSelect }: StageSceneProps) {
  const cardsById = Object.fromEntries(layer.cards.map((card) => [card.id, card]));
  const sceneHeight = Math.max(
    760,
    ...layer.cards.map((card) => card.position.y + estimateCardHeight(card) + 80),
  );
  const sceneWidth = Math.max(1120, ...layer.cards.map((card) => card.position.x + card.position.w + 40));
  const connections = layer.connections
    .map((connection) => {
      const fromCard = cardsById[connection.from];
      const toCard = cardsById[connection.to];

      if (!fromCard || !toCard) {
        return null;
      }

      return {
        connection,
        path: buildConnectorPath(fromCard, toCard),
        label: buildConnectionLabel(connection, fromCard, toCard),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="relative overflow-hidden rounded-[30px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,239,223,0.7))]"
        style={{ minHeight: sceneHeight, minWidth: sceneWidth }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,122,97,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(182,90,40,0.05),transparent_28%)]" />

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
          preserveAspectRatio="none"
        >
          {connections.map(({ connection, path, label }) => (
            <g key={connection.id}>
              <path
                d={path}
                fill="none"
                stroke="rgba(64,44,22,0.22)"
                strokeDasharray="8 8"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
              {label.text ? (
                <g transform={`translate(${label.x}, ${label.y})`}>
                  <rect
                    x="-42"
                    y="-12"
                    width="84"
                    height="24"
                    rx="12"
                    fill="rgba(255,255,255,0.9)"
                    stroke="rgba(32,23,15,0.08)"
                  />
                  <text
                    fill="rgba(87,72,56,0.86)"
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {label.text}
                  </text>
                </g>
              ) : null}
            </g>
          ))}
        </svg>

        <div className="relative min-h-full px-5 py-5">
          {layer.cards.map((card) => (
            <StageCard key={card.id} card={card} selected={card.id === selectedCardId} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
