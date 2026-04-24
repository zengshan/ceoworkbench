import { describe, expect, it } from 'vitest';
import { stageScene } from './mock-data';
import { getHorizontalSceneOffset, getVisibleClusterCards } from './stage-geometry';

describe('stage geometry alignment', () => {
  it('centers the scene when the viewport is wider than the designed canvas', () => {
    expect(getHorizontalSceneOffset(1280, 1158)).toBe(61);
  });

  it('keeps the scene flush left when the viewport is narrower than the canvas', () => {
    expect(getHorizontalSceneOffset(960, 1158)).toBe(0);
  });

  it('shows only one supporting card per non-CEO cluster in CEO focus', () => {
    const officeCluster = stageScene.clusters.find((cluster) => cluster.id === 'office');
    const designCluster = stageScene.clusters.find((cluster) => cluster.id === 'design');
    const engineeringCluster = stageScene.clusters.find((cluster) => cluster.id === 'engineering');

    expect(officeCluster).toBeDefined();
    expect(designCluster).toBeDefined();
    expect(engineeringCluster).toBeDefined();

    expect(getVisibleClusterCards(officeCluster!, 'ceo')).toHaveLength(1);
    expect(getVisibleClusterCards(designCluster!, 'ceo')).toHaveLength(1);
    expect(getVisibleClusterCards(engineeringCluster!, 'ceo')).toHaveLength(1);
  });

  it('shows only one summary card for every non-focused cluster in department views too', () => {
    const ceoCluster = stageScene.clusters.find((cluster) => cluster.id === 'ceo');
    const officeCluster = stageScene.clusters.find((cluster) => cluster.id === 'office');
    const engineeringCluster = stageScene.clusters.find((cluster) => cluster.id === 'engineering');

    expect(ceoCluster).toBeDefined();
    expect(officeCluster).toBeDefined();
    expect(engineeringCluster).toBeDefined();

    expect(getVisibleClusterCards(ceoCluster!, 'design')).toHaveLength(1);
    expect(getVisibleClusterCards(officeCluster!, 'design')).toHaveLength(1);
    expect(getVisibleClusterCards(engineeringCluster!, 'design')).toHaveLength(1);
  });

  it('keeps all cards visible when a cluster itself is focused', () => {
    const officeCluster = stageScene.clusters.find((cluster) => cluster.id === 'office');

    expect(officeCluster).toBeDefined();
    expect(getVisibleClusterCards(officeCluster!, 'office')).toHaveLength(officeCluster!.cards.length);
  });
});
