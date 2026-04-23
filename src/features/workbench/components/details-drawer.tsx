import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/pill';
import type { CanvasCardRecord } from '@/features/workbench/types';

type PendingGroup = {
  projectName: string;
  projectPriority: 'P0' | 'P1' | 'P2';
  items: {
    id: string;
    title: string;
    severity: 'light' | 'medium' | 'heavy';
    recommendation: string;
    impact: string;
  }[];
};

export function DetailsDrawer({
  card,
  pendingGroups,
}: {
  card: CanvasCardRecord;
  pendingGroups: PendingGroup[];
}) {
  const currentGroup = pendingGroups.find((group) => group.items.some((item) => item.title === card.title)) ?? pendingGroups[0];
  const currentPending = currentGroup?.items.find((item) => item.title === card.title) ?? currentGroup?.items[0];

  return (
    <Panel className="flex h-full min-h-[760px] flex-col gap-5 p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Pill label={card.type} tone={card.type === 'approval' ? 'warning' : 'accent'} />
          <Pill label={card.status} tone={card.status === 'blocked' ? 'danger' : 'neutral'} />
        </div>
        <div>
          <h2 className="text-xl font-semibold leading-8">{card.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.summary}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-white/60 p-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">当前负责人</div>
            <div className="mt-1 font-medium">{card.owner}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">更新时间</div>
            <div className="mt-1 font-medium">{card.updatedAt}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-[22px] border border-[var(--line)] bg-white/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">待处理上下文</div>
            <div className="mt-1 text-sm font-medium">{currentGroup?.projectName}</div>
          </div>
          {currentGroup ? <Pill label={currentGroup.projectPriority} tone="accent" /> : null}
        </div>
        {currentPending ? (
          <>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">总经理建议</div>
              <p className="mt-2 text-sm leading-6">{currentPending.recommendation}</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">不处理影响</div>
              <p className="mt-2 text-sm leading-6 text-[var(--danger)]">{currentPending.impact}</p>
            </div>
          </>
        ) : null}
      </div>

      <div className="space-y-3 rounded-[22px] border border-[var(--line)] bg-[rgba(31,122,97,0.08)] p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">立即动作</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <button type="button" className="rounded-full bg-[var(--accent)] px-4 py-3 font-medium text-white">
            批准继续
          </button>
          <button type="button" className="rounded-full border border-[var(--line)] bg-white px-4 py-3 font-medium">
            改方向
          </button>
          <button type="button" className="rounded-full border border-[var(--line)] bg-white px-4 py-3 font-medium">
            暂停
          </button>
          <button type="button" className="rounded-full border border-[var(--line)] bg-white px-4 py-3 font-medium">
            进入对话
          </button>
        </div>
      </div>
    </Panel>
  );
}
