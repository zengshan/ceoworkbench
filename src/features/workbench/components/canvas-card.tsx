'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Pill } from '@/components/ui/pill';
import { useWorkbenchStore } from '@/features/workbench/store';
import type { CanvasCardRecord } from '@/features/workbench/types';

type WorkbenchNode = Node<{ card: CanvasCardRecord }, 'workbenchCard'>;

export function CanvasCard({ data, selected }: NodeProps<WorkbenchNode>) {
  const selectCard = useWorkbenchStore((state) => state.selectCard);
  const card = data.card;
  const tone = card.type === 'approval' ? 'warning' : card.type === 'project' ? 'accent' : 'neutral';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-[var(--line-strong)]" />
      <button
        type="button"
        onClick={() => selectCard(card.id)}
        className={`w-[240px] rounded-[24px] border p-4 text-left shadow-[0_18px_40px_rgba(70,52,30,0.08)] transition ${
          selected ? 'border-[var(--accent)] bg-white' : 'border-[var(--line)] bg-[var(--panel-strong)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <Pill label={card.type} tone={tone} />
          <span className="text-xs text-[var(--muted)]">{card.updatedAt}</span>
        </div>
        <div className="mt-3 text-base font-semibold leading-6">{card.title}</div>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.summary}</p>
        <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">负责人 · {card.owner}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <Pill key={tag} label={tag} tone="neutral" />
          ))}
        </div>
      </button>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-[var(--line-strong)]" />
    </>
  );
}
