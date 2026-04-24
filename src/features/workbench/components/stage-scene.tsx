'use client';

import type { StageFocusId, StageSceneRecord } from '@/features/workbench/types';
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
  const layouts = scene.clusters.map((cluster) => ({
    cluster,
    layout: cluster.layoutsByFocus[activeFocusId],
  }));

  const sceneHeight = Math.max(
    780,
    ...layouts.map(({ layout }) => layout.y + (layout.mode === 'focused' ? 480 : 280)),
  );
  const sceneWidth = Math.max(1180, ...layouts.map(({ layout }) => layout.x + layout.w + 120));
  const anchors = Object.fromEntries(
    layouts.map(({ cluster, layout }) => [
      cluster.id,
      {
        x: layout.x + layout.w / 2,
        y: layout.y + (layout.mode === 'focused' ? 180 : layout.mode === 'supporting' ? 130 : 92),
      },
    ]),
  ) as Record<StageFocusId, { x: number; y: number }>;

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="relative overflow-hidden rounded-[30px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,239,223,0.72))]"
        style={{ minHeight: sceneHeight, minWidth: sceneWidth }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,122,97,0.06),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(182,90,40,0.05),transparent_28%)]" />
        <StageConnectorLayer connectors={scene.connections} anchors={anchors} height={sceneHeight} width={sceneWidth} />
        <div className="relative min-h-full px-6 py-6">
          {layouts.map(({ cluster, layout }) => (
            <StageCluster
              key={cluster.id}
              cluster={cluster}
              layout={layout}
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
