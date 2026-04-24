'use client';

import { Pill } from '@/components/ui/pill';
import type { TeamDepartment } from '@/features/workbench/types';

export function WorkspaceTeamList({ departments }: { departments: TeamDepartment[] }) {
  return (
    <div className="space-y-3 overflow-y-auto pr-1">
      {departments.map((department) => (
        <div key={department.id} className="rounded-[22px] border border-[var(--line)] bg-white/84 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{department.name}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{department.summary}</div>
            </div>
            <Pill label={`${department.agents.length} 位 agent`} tone="neutral" />
          </div>
          <div className="mt-4 space-y-2">
            {department.agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-[18px] border border-[var(--line)] bg-[rgba(255,255,255,0.8)] px-4 py-3"
              >
                <div className="text-sm font-medium">{agent.name}</div>
                {agent.title ? <div className="mt-1 text-sm text-[var(--muted)]">{agent.title}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
