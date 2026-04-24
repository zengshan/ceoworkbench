'use client';

import { Panel } from '@/components/ui/panel';
import { useWorkbenchStore } from '@/features/workbench/store';
import { StageLayerSwitcher } from './stage-layer-switcher';
import { StageScene } from './stage-scene';

export function CanvasBoard() {
  const stageScene = useWorkbenchStore((state) => state.stageScene);
  const activeStageFocusId = useWorkbenchStore((state) => state.activeStageFocusId);
  const selectedStageCardIds = useWorkbenchStore((state) => state.selectedStageCardIds);
  const setActiveStageFocus = useWorkbenchStore((state) => state.setActiveStageFocus);
  const selectStageCard = useWorkbenchStore((state) => state.selectStageCard);

  if (!stageScene.clusters.length) {
    return (
      <Panel className="min-h-[760px] overflow-hidden">
        <div aria-hidden="true" className="h-full min-h-[728px] border border-dashed border-[var(--line)]" />
      </Panel>
    );
  }

  return (
    <Panel className="flex min-h-[760px] min-w-0 flex-col overflow-hidden">
      <div className="border-b border-[rgba(74,58,39,0.08)] px-4 py-4">
        <StageLayerSwitcher
          clusters={stageScene.clusters}
          focusOrder={stageScene.focusOrder}
          activeFocusId={activeStageFocusId}
          onChange={setActiveStageFocus}
        />
      </div>
      <StageScene
        scene={stageScene}
        activeFocusId={activeStageFocusId}
        selectedStageCardIds={selectedStageCardIds}
        onFocus={setActiveStageFocus}
        onSelectCard={selectStageCard}
      />
    </Panel>
  );
}
