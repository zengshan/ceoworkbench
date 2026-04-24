import { Panel } from '@/components/ui/panel';
import { Pill } from '@/components/ui/pill';

export function WorkbenchHeader() {
  return (
    <Panel className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">CEO 工作台</div>
        <h1 className="mt-2 text-2xl font-semibold">wanman.ai</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          通过 Office 组织设计与开发推进，让 CEO 始终看见公司当前运行态与关键决策点。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Pill label="P0 · watch" tone="accent" />
        <div className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm text-[var(--muted)]">
          搜索此故事
        </div>
        <div className="flex items-center gap-3 rounded-full border border-[var(--line)] bg-white/75 px-3 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
            CEO
          </div>
          <div>
            <div className="text-sm font-medium">Founder</div>
            <div className="text-xs text-[var(--muted)]">1 家公司运行中</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            切换公司
          </button>
        </div>
      </div>
    </Panel>
  );
}
