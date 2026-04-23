import { Panel } from '@/components/ui/panel';

export function CommandBar() {
  return (
    <Panel className="sticky bottom-4 mt-4 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-[var(--muted)]">
          给总经理下达项目任务，或对当前事项直接批示。
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-full border border-[var(--line)] bg-white px-4 py-3">
          <span className="text-sm text-[var(--muted)]">帮我给 wanman.ai 设计一个新的 iOS app...</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className="rounded-full bg-[var(--accent)] px-4 py-3 font-medium text-white">
            发送给总经理
          </button>
        </div>
      </div>
    </Panel>
  );
}
