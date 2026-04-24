import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from './store';

describe('useWorkbenchStore stage layers', () => {
  beforeEach(() => {
    useWorkbenchStore.setState(useWorkbenchStore.getInitialState(), true);
  });

  it('defaults to the CEO stage layer and first CEO card', () => {
    const state = useWorkbenchStore.getState();
    const ceoLayer = state.stageLayers.find((layer) => layer.id === 'ceo');

    expect(state.stageLayers.map((layer) => layer.label)).toEqual(['CEO层', '设计部', '开发部']);
    expect(state.activeStageLayerId).toBe('ceo');
    expect(state.selectedStageCardId).toBe('ceo-progress');
    expect(ceoLayer?.cards.map((card) => `${card.id}:${card.title}`)).toEqual([
      'ceo-progress:本轮工作进度',
      'ceo-design-summary:设计部总结',
      'ceo-engineering-summary:开发部总结',
    ]);
  });


  it('falls back to the first layer when switching to an unknown layer id', () => {
    const { setActiveStageLayer, stageLayers } = useWorkbenchStore.getState();

    useWorkbenchStore.setState({
      stageLayers: [stageLayers[1], stageLayers[0], stageLayers[2]],
      activeStageLayerId: 'ceo',
      selectedStageCardId: 'ceo-progress',
    });

    setActiveStageLayer('unknown-layer' as never);

    const state = useWorkbenchStore.getState();

    expect(state.activeStageLayerId).toBe('design');
    expect(state.selectedStageCardId).toBe('design-progress');
  });

  it('switches layers and selects the first card in the chosen layer', () => {
    const { setActiveStageLayer } = useWorkbenchStore.getState();

    setActiveStageLayer('design');

    const state = useWorkbenchStore.getState();

    expect(state.activeStageLayerId).toBe('design');
    expect(state.selectedStageCardId).toBe('design-progress');
  });

  it('preserves the selected card when reselecting the active layer', () => {
    const { selectStageCard, setActiveStageLayer } = useWorkbenchStore.getState();

    setActiveStageLayer('design');
    selectStageCard('design-feedback');
    setActiveStageLayer('design');

    const state = useWorkbenchStore.getState();

    expect(state.activeStageLayerId).toBe('design');
    expect(state.selectedStageCardId).toBe('design-feedback');
  });

  it('updates the selected stage card directly', () => {
    const { selectStageCard } = useWorkbenchStore.getState();

    selectStageCard('ceo-design-summary');

    expect(useWorkbenchStore.getState().selectedStageCardId).toBe('ceo-design-summary');
  });

  it('exposes stage card positions as clear pixel values', () => {
    const positions = useWorkbenchStore
      .getState()
      .stageLayers.flatMap((layer) => layer.cards.map((card) => card.position));

    expect(positions.every((position) => Number.isInteger(position.x))).toBe(true);
    expect(positions.every((position) => Number.isInteger(position.y))).toBe(true);
    expect(positions.every((position) => Number.isInteger(position.w))).toBe(true);
    expect(positions.every((position) => position.w >= 240)).toBe(true);
  });
});
