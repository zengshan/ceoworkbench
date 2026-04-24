'use client';

import { Panel } from '@/components/ui/panel';
import { useWorkbenchStore } from '@/features/workbench/store';
import { StageLayerSwitcher } from './stage-layer-switcher';
import { StageScene } from './stage-scene';

export function CanvasBoard() {
  const stageLayers = useWorkbenchStore((state) => state.stageLayers);
  const activeStageLayerId = useWorkbenchStore((state) => state.activeStageLayerId);
  const selectedStageCardId = useWorkbenchStore((state) => state.selectedStageCardId);
  const setActiveStageLayer = useWorkbenchStore((state) => state.setActiveStageLayer);
  const selectStageCard = useWorkbenchStore((state) => state.selectStageCard);

  const activeLayer = stageLayers.find((layer) => layer.id === activeStageLayerId) ?? stageLayers[0];

  if (!activeLayer) {
    return (
      <Panel className="min-h-[760px] p-4">
        <div aria-hidden="true" className="h-full min-h-[728px] rounded-[24px] border border-dashed border-[var(--line)]" />
      </Panel>
    );
  }

  return (
    <Panel className="flex min-h-[760px] flex-col gap-4 p-4">
      <StageLayerSwitcher layers={stageLayers} activeLayerId={activeLayer.id} onChange={setActiveStageLayer} />
      <StageScene layer={activeLayer} selectedCardId={selectedStageCardId} onSelect={selectStageCard} />
    </Panel>
  );
}
