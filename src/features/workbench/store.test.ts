import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from './store';

describe('useWorkbenchStore company wall', () => {
  beforeEach(() => {
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
  });

  it('defaults to the CEO focus and seeded cluster selections', () => {
    const state = useWorkbenchStore.getState();

    expect(state.stageScene.focusOrder).toEqual(['ceo', 'manager', 'design', 'engineering']);
    expect(state.stageScene.clusters.map((cluster) => cluster.id)).toEqual(['ceo', 'manager', 'design', 'engineering']);
    expect(state.activeStageFocusId).toBe('ceo');
    expect(state.selectedStageCardIds).toEqual({
      ceo: 'ceo-progress',
      manager: 'manager-judgment',
      design: 'design-progress',
      engineering: 'engineering-progress',
    });
  });

  it('keeps all organization clusters in the scene while moving focus', () => {
    const state = useWorkbenchStore.getState();

    expect(state.stageScene.focusOrder).toEqual(['ceo', 'manager', 'design', 'engineering']);
    expect(state.activeStageFocusId).toBe('ceo');
    expect(state.stageScene.clusters.map((cluster) => cluster.id)).toEqual(['ceo', 'manager', 'design', 'engineering']);

    state.setActiveStageFocus('design');

    const nextState = useWorkbenchStore.getState();
    expect(nextState.activeStageFocusId).toBe('design');
    expect(nextState.selectedStageCardIds.design).toBe('design-progress');
    expect(nextState.selectedStageCardIds.ceo).toBe('ceo-progress');
  });

  it('preserves cluster card selection when returning to a previous focus', () => {
    const { selectStageCard, setActiveStageFocus } = useWorkbenchStore.getState();

    selectStageCard('design', 'design-handoff');
    setActiveStageFocus('engineering');
    setActiveStageFocus('design');

    const state = useWorkbenchStore.getState();

    expect(state.activeStageFocusId).toBe('design');
    expect(state.selectedStageCardIds.design).toBe('design-handoff');
    expect(state.selectedStageCardIds.engineering).toBe('engineering-progress');
  });

  it('updates the selected stage card within a cluster directly', () => {
    const { selectStageCard } = useWorkbenchStore.getState();

    selectStageCard('manager', 'manager-report');

    expect(useWorkbenchStore.getState().selectedStageCardIds.manager).toBe('manager-report');
  });

  it('exposes focus layouts as clear pixel values for every cluster', () => {
    const layouts = useWorkbenchStore
      .getState()
      .stageScene.clusters.flatMap((cluster) => Object.values(cluster.layoutsByFocus));

    expect(layouts.every((layout) => Number.isInteger(layout.x))).toBe(true);
    expect(layouts.every((layout) => Number.isInteger(layout.y))).toBe(true);
    expect(layouts.every((layout) => Number.isInteger(layout.w))).toBe(true);
    expect(layouts.every((layout) => layout.w >= 180)).toBe(true);
  });
});
