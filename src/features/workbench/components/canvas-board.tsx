'use client';

import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import { Panel } from '@/components/ui/panel';
import type { CanvasCardRecord, CanvasLane } from '@/features/workbench/types';
import { CanvasCard } from './canvas-card';

const nodeTypes: NodeTypes = {
  workbenchCard: CanvasCard,
};

const lanePosition: Record<CanvasLane, { x: number; y: number }> = {
  ceo: { x: 40, y: 40 },
  manager: { x: 340, y: 80 },
  design: { x: 660, y: 110 },
  engineering: { x: 1020, y: 320 },
  decisions: { x: 1020, y: 60 },
};

const laneTitles: Array<{ lane: CanvasLane; label: string; x: number; y: number }> = [
  { lane: 'ceo', label: 'CEO', x: 40, y: 14 },
  { lane: 'manager', label: 'GENERAL MANAGER', x: 340, y: 14 },
  { lane: 'design', label: 'DESIGN', x: 660, y: 14 },
  { lane: 'engineering', label: 'ENGINEERING', x: 1020, y: 274 },
  { lane: 'decisions', label: 'DECISIONS', x: 1020, y: 14 },
];

type LaneSummary = {
  lane: CanvasLane;
  title: string;
  status: string;
  focus: string;
  blocker?: string;
};

function buildLaneSummaries(cards: CanvasCardRecord[]): LaneSummary[] {
  const byLane = (lane: CanvasLane) => cards.filter((card) => card.lane === lane);
  const designCards = byLane('design');
  const engineeringCards = byLane('engineering');
  const managerCards = byLane('manager');

  const designSubmitted = designCards.some((card) => card.status === 'submitted' || card.status === 'ready');
  const engineeringBlocked = engineeringCards.find((card) => card.status === 'blocked');
  const managerPending = managerCards.some((card) => card.status === 'awaiting_ceo');

  return [
    {
      lane: 'manager',
      title: '总经理正在做什么',
      status: managerPending ? '等待 CEO 确认' : '持续推进',
      focus: managerPending ? '已汇总设计交付，正在组织进入开发前的确认。' : '正在协调部门推进。',
    },
    {
      lane: 'design',
      title: '设计部当前进度',
      status: designSubmitted ? '已提交交付' : '推进中',
      focus: designSubmitted ? '首页方向与 spec 已输出，当前停在设计确认环节。' : '正在产出方案与 spec。',
    },
    {
      lane: 'engineering',
      title: '开发部当前卡点',
      status: engineeringBlocked ? '阻塞' : '可推进',
      focus: engineeringBlocked ? '开发启动骨架已准备，但尚未进入编码。' : '正在进入编码阶段。',
      blocker: engineeringBlocked?.tags.find((tag) => tag.includes('等待')) ?? undefined,
    },
  ];
}

function buildNodes(cards: CanvasCardRecord[]): Node[] {
  const laneOffsets: Record<CanvasLane, number> = {
    ceo: 0,
    manager: 0,
    design: 0,
    engineering: 0,
    decisions: 0,
  };

  return cards.map((card) => {
    const position = lanePosition[card.lane];
    const offset = laneOffsets[card.lane];
    laneOffsets[card.lane] += 230;

    return {
      id: card.id,
      type: 'workbenchCard',
      position: { x: position.x, y: position.y + offset },
      data: { card },
      draggable: false,
      selectable: true,
    };
  });
}

function buildEdges(cards: CanvasCardRecord[]): Edge[] {
  const ids = Object.fromEntries(cards.map((card) => [card.id, card.id]));

  return [
    ['project-1', 'report-1'],
    ['report-1', 'task-1'],
    ['task-1', 'deliverable-1'],
    ['deliverable-1', 'approval-1'],
    ['approval-1', 'task-2'],
  ]
    .filter(([source, target]) => ids[source] && ids[target])
    .map(([source, target]) => ({
      id: `${source}-${target}`,
      source,
      target,
      animated: target === 'approval-1',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(64,44,22,0.35)' },
      style: { stroke: 'rgba(64,44,22,0.35)', strokeWidth: 1.25 },
    }));
}

export function CanvasBoard({ cards, selectedCardId }: { cards: CanvasCardRecord[]; selectedCardId: string }) {
  const nodes = buildNodes(cards).map((node) => ({ ...node, selected: node.id === selectedCardId }));
  const edges = buildEdges(cards);
  const laneSummaries = buildLaneSummaries(cards);

  return (
    <Panel className="relative min-h-[760px] overflow-hidden p-3">
      <div className="mb-3 rounded-[24px] border border-[var(--line)] bg-[rgba(247,239,223,0.9)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">公司大战略</div>
            <div className="mt-1 text-lg font-semibold">先锁定 iOS 核心体验，再由总经理组织设计确认后进入开发。</div>
          </div>
          <div className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted)]">
            修改这里 = 公司战略变化
          </div>
        </div>
      </div>
      <div className="mb-3 rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">部门运行态</div>
            <div className="mt-1 text-sm text-[var(--muted)]">不用读卡片推断，直接看各部门当前动作和阻塞点。</div>
          </div>
          <div className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--muted)]">
            当前主战场 · wanman.ai iOS App
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {laneSummaries.map((summary) => (
            <div key={summary.lane} className="rounded-[20px] border border-[var(--line)] bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">{summary.title}</div>
                <div className="rounded-full bg-[rgba(32,23,15,0.06)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                  {summary.status}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{summary.focus}</p>
              {summary.blocker ? (
                <div className="mt-3 rounded-[16px] bg-[rgba(158,59,47,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
                  当前卡点: {summary.blocker}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-6 top-4 z-10 flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
        {laneTitles.map((lane) => (
          <div key={lane.lane} style={{ marginLeft: lane.x === 40 ? 0 : undefined }}>
            {lane.label}
          </div>
        ))}
      </div>
      <div className="h-[760px] overflow-hidden rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.4)]">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView={false}
            defaultViewport={{ x: 0, y: 0, zoom: 0.84 }}
            minZoom={0.6}
            maxZoom={1.2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(64,44,22,0.08)" gap={24} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </Panel>
  );
}
