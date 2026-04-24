import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from './store';

function estimateClusterHeight(mode: 'focused' | 'supporting' | 'compressed', cards: number) {
  const labelHeight = 40;
  const cardHeight = mode === 'focused' ? 210 : mode === 'supporting' ? 170 : 112;
  const gap = mode === 'focused' ? 12 : 8;
  return labelHeight + cards * cardHeight + Math.max(0, cards - 1) * gap;
}

function overlaps(
  first: { x: number; y: number; w: number; h: number },
  second: { x: number; y: number; w: number; h: number },
) {
  return !(
    first.x + first.w <= second.x ||
    second.x + second.w <= first.x ||
    first.y + first.h <= second.y ||
    second.y + second.h <= first.y
  );
}

describe('useWorkbenchStore company wall', () => {
  beforeEach(() => {
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
  });

  it('defaults to the CEO focus and seeded cluster selections', () => {
    const state = useWorkbenchStore.getState();

    expect(state.stageScene.focusOrder).toEqual(['ceo', 'office', 'design', 'engineering']);
    expect(state.stageScene.clusters.map((cluster) => cluster.id)).toEqual(['ceo', 'office', 'design', 'engineering']);
    expect(state.activeStageFocusId).toBe('ceo');
    expect(state.selectedStageCardIds).toEqual({
      ceo: 'ceo-progress',
      office: 'office-judgment',
      design: 'design-progress',
      engineering: 'engineering-progress',
    });
  });

  it('keeps all organization clusters in the scene while moving focus', () => {
    const state = useWorkbenchStore.getState();

    expect(state.stageScene.focusOrder).toEqual(['ceo', 'office', 'design', 'engineering']);
    expect(state.activeStageFocusId).toBe('ceo');
    expect(state.stageScene.clusters.map((cluster) => cluster.id)).toEqual(['ceo', 'office', 'design', 'engineering']);

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

    selectStageCard('office', 'office-report');

    expect(useWorkbenchStore.getState().selectedStageCardIds.office).toBe('office-report');
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

  it('keeps CEO-view supporting clusters visually separated', () => {
    const { stageScene } = useWorkbenchStore.getState();
    const supportClusters = stageScene.clusters
      .filter((cluster) => cluster.id !== 'ceo')
      .map((cluster) => {
        const layout = cluster.layoutsByFocus.ceo;
        return {
          id: cluster.id,
          box: {
            x: layout.x,
            y: layout.y,
            w: layout.w,
            h: estimateClusterHeight(layout.mode, cluster.cards.length),
          },
        };
      });

    for (let index = 0; index < supportClusters.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < supportClusters.length; nextIndex += 1) {
        expect(
          overlaps(supportClusters[index].box, supportClusters[nextIndex].box),
          `${supportClusters[index].id} overlaps ${supportClusters[nextIndex].id} in CEO view`,
        ).toBe(false);
      }
    }
  });

  it('tracks workspace overlay defaults separately from stage focus', () => {
    const state = useWorkbenchStore.getState();

    expect(state.workspaceOpen).toBe(false);
    expect(state.workspaceView).toBe('conversations');
    expect(state.lastWorkspaceThreadId).toBe('thread-manager');
    expect(state.workspaceUnreadCount).toBe(2);
    expect(state.activeStageFocusId).toBe('ceo');
  });

  it('restores the last workspace thread when reopening the overlay', () => {
    const store = useWorkbenchStore.getState();

    store.selectThread('thread-design');
    store.setWorkspaceOpen(false);
    store.setWorkspaceOpen(true);

    expect(useWorkbenchStore.getState().selectedThreadId).toBe('thread-design');
    expect(useWorkbenchStore.getState().lastWorkspaceThreadId).toBe('thread-design');
  });

  it('keeps the selected thread while switching workspace tabs', () => {
    const store = useWorkbenchStore.getState();

    store.selectThread('thread-engineering');
    store.setWorkspaceView('team');
    store.setWorkspaceView('conversations');

    expect(useWorkbenchStore.getState().selectedThreadId).toBe('thread-engineering');
  });
});
