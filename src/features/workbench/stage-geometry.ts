import type {
  StageCluster,
  StageClusterConnection,
  StageClusterLayout,
  StageFocusId,
  StageSceneRecord,
} from './types';

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Point = {
  x: number;
  y: number;
};

export type RenderedConnector = {
  id: string;
  path: string;
  label?: string;
  labelX: number;
  labelY: number;
  isActive: boolean;
  fromCardId?: string;
  toCardId?: string;
};

const LABEL_HEIGHT = 42;

export function estimateCardHeight(mode: 'focused' | 'supporting' | 'compressed', body: string, artifactCount = 0) {
  if (mode === 'compressed') {
    return 88;
  }

  const charsPerLine = mode === 'focused' ? 28 : 24;
  const bodyLines = Math.max(2, Math.ceil(body.length / charsPerLine));
  const baseHeight = mode === 'focused' ? 168 : 148;
  const lineHeight = mode === 'focused' ? 18 : 16;
  const artifactRows = artifactCount ? Math.ceil(artifactCount / 2) : 0;

  return baseHeight + bodyLines * lineHeight + artifactRows * 20;
}

export function estimateClusterHeight(
  cards: StageCluster['cards'],
  mode: 'focused' | 'supporting' | 'compressed',
) {
  const gap = mode === 'focused' ? 12 : 8;

  return (
    LABEL_HEIGHT +
    cards.reduce((total, card) => total + estimateCardHeight(mode, card.body, card.artifactLabels?.length ?? 0), 0) +
    Math.max(0, cards.length - 1) * gap
  );
}

function buildCardRects(cluster: StageCluster, layout: StageClusterLayout) {
  const gap = layout.mode === 'focused' ? 12 : 8;
  let nextY = layout.y + LABEL_HEIGHT;

  return Object.fromEntries(
    cluster.cards.map((card) => {
      const h = estimateCardHeight(layout.mode, card.body, card.artifactLabels?.length ?? 0);
      const rect: Rect = { x: layout.x, y: nextY, w: layout.w, h };

      nextY += h + gap;

      return [card.id, rect];
    }),
  ) as Record<string, Rect>;
}

function getFallbackCardId(cluster: StageCluster) {
  return cluster.cards[0]?.id;
}

function getCardRect(
  cluster: StageCluster,
  cardRects: Record<string, Rect>,
  cardId?: string,
) {
  const resolvedCardId = cardId && cardRects[cardId] ? cardId : getFallbackCardId(cluster);

  if (!resolvedCardId) {
    return null;
  }

  return {
    cardId: resolvedCardId,
    rect: cardRects[resolvedCardId],
  };
}

function getRectCenter(rect: Rect): Point {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}

function getConnectorEndpoints(fromRect: Rect, toRect: Rect) {
  const fromCenter = getRectCenter(fromRect);
  const toCenter = getRectCenter(toRect);

  if (fromRect.x + fromRect.w <= toRect.x) {
    return {
      start: { x: fromRect.x + fromRect.w, y: fromCenter.y },
      end: { x: toRect.x, y: toCenter.y },
      axis: 'horizontal' as const,
    };
  }

  if (toRect.x + toRect.w <= fromRect.x) {
    return {
      start: { x: fromRect.x, y: fromCenter.y },
      end: { x: toRect.x + toRect.w, y: toCenter.y },
      axis: 'horizontal' as const,
    };
  }

  if (fromRect.y + fromRect.h <= toRect.y) {
    return {
      start: { x: fromCenter.x, y: fromRect.y + fromRect.h },
      end: { x: toCenter.x, y: toRect.y },
      axis: 'vertical' as const,
    };
  }

  return {
    start: { x: fromCenter.x, y: fromRect.y },
    end: { x: toCenter.x, y: toRect.y + toRect.h },
    axis: 'vertical' as const,
  };
}

function buildConnectorPath(start: Point, end: Point, axis: 'horizontal' | 'vertical') {
  if (axis === 'horizontal') {
    const controlOffset = Math.max(64, Math.abs(end.x - start.x) * 0.32);

    return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;
  }

  const controlOffset = Math.max(52, Math.abs(end.y - start.y) * 0.28);

  return `M ${start.x} ${start.y} C ${start.x} ${start.y + controlOffset}, ${end.x} ${end.y - controlOffset}, ${end.x} ${end.y}`;
}

function buildLabelPosition(start: Point, end: Point, axis: 'horizontal' | 'vertical') {
  if (axis === 'horizontal') {
    return {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2 - 18,
    };
  }

  return {
    x: (start.x + end.x) / 2 + 22,
    y: (start.y + end.y) / 2,
  };
}

function buildConnectorGeometry(
  connector: StageClusterConnection,
  clustersById: Record<StageFocusId, StageCluster>,
  cardRectsByCluster: Record<StageFocusId, Record<string, Rect>>,
  activeFocusId: StageFocusId,
): RenderedConnector | null {
  const fromCluster = clustersById[connector.fromClusterId];
  const toCluster = clustersById[connector.toClusterId];

  if (!fromCluster || !toCluster) {
    return null;
  }

  const fromCard = getCardRect(fromCluster, cardRectsByCluster[connector.fromClusterId], connector.fromCardId);
  const toCard = getCardRect(toCluster, cardRectsByCluster[connector.toClusterId], connector.toCardId);

  if (!fromCard || !toCard) {
    return null;
  }

  const { start, end, axis } = getConnectorEndpoints(fromCard.rect, toCard.rect);
  const label = buildLabelPosition(start, end, axis);

  return {
    id: connector.id,
    path: buildConnectorPath(start, end, axis),
    label: connector.label,
    labelX: label.x,
    labelY: label.y,
    isActive: connector.fromClusterId === activeFocusId || connector.toClusterId === activeFocusId,
    fromCardId: fromCard.cardId,
    toCardId: toCard.cardId,
  };
}

export function getStageSceneGeometry(scene: StageSceneRecord, activeFocusId: StageFocusId) {
  const clustersById = Object.fromEntries(scene.clusters.map((cluster) => [cluster.id, cluster])) as Record<StageFocusId, StageCluster>;

  const layouts = scene.clusters.map((cluster) => ({
    cluster,
    layout: cluster.layoutsByFocus[activeFocusId],
  }));

  const cardRectsByCluster = Object.fromEntries(
    layouts.map(({ cluster, layout }) => [cluster.id, buildCardRects(cluster, layout)]),
  ) as Record<StageFocusId, Record<string, Rect>>;

  const clusterRects = Object.fromEntries(
    layouts.map(({ cluster, layout }) => [
      cluster.id,
      {
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: estimateClusterHeight(cluster.cards, layout.mode),
      },
    ]),
  ) as Record<StageFocusId, Rect>;

  const connectors = scene.connections
    .map((connector) => buildConnectorGeometry(connector, clustersById, cardRectsByCluster, activeFocusId))
    .filter((connector): connector is RenderedConnector => Boolean(connector));

  const sceneHeight = Math.max(
    0,
    ...Object.values(clusterRects).map((rect) => rect.y + rect.h + 72),
  );
  const sceneWidth = Math.max(1120, ...Object.values(clusterRects).map((rect) => rect.x + rect.w + 104));

  return {
    layouts,
    clusterRects,
    cardRectsByCluster,
    connectors,
    sceneHeight,
    sceneWidth,
  };
}
