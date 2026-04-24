'use client';

import { useEffect, useRef, useState } from 'react';
import type { StageFocusId, StageSceneRecord } from '@/features/workbench/types';
import { getHorizontalSceneOffset, getStageSceneGeometry, getVisibleClusterCards } from '@/features/workbench/stage-geometry';
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
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(sceneWidth);

  useEffect(() => {
    const element = scrollRegionRef.current;

    if (!element) {
      return undefined;
    }

    const updateViewportWidth = () => {
      setViewportWidth(element.clientWidth);
    };

    updateViewportWidth();

    const observer = new ResizeObserver(updateViewportWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [sceneWidth]);

  const sceneOffsetX = getHorizontalSceneOffset(viewportWidth, sceneWidth);
  const sceneFrameWidth = sceneWidth + sceneOffsetX * 2;

  return (
    <div ref={scrollRegionRef} className="relative min-h-0 flex-1 overflow-auto" data-testid="stage-scroll-region">
      <div
        className="relative min-h-full"
        style={{ minHeight: sceneHeight, width: sceneFrameWidth }}
        data-testid="stage-scene-frame"
        data-scene-offset-x={sceneOffsetX}
      >
        <div
          className="relative bg-[var(--panel-strong)]"
          style={{ marginLeft: sceneOffsetX, minHeight: sceneHeight, width: sceneWidth }}
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
              cards={getVisibleClusterCards(cluster, activeFocusId)}
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
    </div>
  );
}
