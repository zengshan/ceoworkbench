'use client';

import type { StageFocusId, StageSceneRecord } from '@/features/workbench/types';
import { getStageSceneGeometry } from '@/features/workbench/stage-geometry';
import { StageCluster } from './stage-cluster';
import { StageConnectorLayer } from './stage-connector-layer';

type StageSceneProps = {
  scene: StageSceneRecord;
  activeFocusId: StageFocusId;
  selectedStageCardIds: Record<StageFocusId, string | null>;
  onFocus: (focusId: StageFocusId) => void;
  onSelectCard: (focusId: StageFocusId, cardId: string) => void;
};

export function StageScene({ scene, activeFocusId, selectedStageCardIds, onFocus, onSelectCard }: StageSceneProps) {
  const { layouts, connectors, sceneHeight, sceneWidth } = getStageSceneGeometry(scene, activeFocusId);

  return (
    <div className="relative min-h-0 flex-1 overflow-auto" data-testid="stage-scroll-region">
      <div
        className="relative min-h-full min-w-full bg-[var(--panel-strong)]"
        style={{ minHeight: sceneHeight, minWidth: sceneWidth }}
        data-testid="stage-scene-root"
        data-scene-height={sceneHeight}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.66),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.42),transparent_30%)]" />
        <StageConnectorLayer connectors={connectors} height={sceneHeight} width={sceneWidth} />
        <div className="relative min-h-full">
          {layouts.map(({ cluster, layout }) => (
            <StageCluster
              key={cluster.id}
              cluster={cluster}
              layout={layout}
              focusState={cluster.id === activeFocusId ? 'active' : 'background'}
              selectedCardId={selectedStageCardIds[cluster.id]}
              onFocus={onFocus}
              onSelectCard={onSelectCard}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
