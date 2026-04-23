import type { PendingItem, ProjectPriority } from './types';

const priorityRank: Record<ProjectPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const severityRank = {
  heavy: 0,
  medium: 1,
  light: 2,
};

export function groupPendingItems(items: PendingItem[]) {
  const grouped = new Map<
    string,
    {
      projectName: string;
      projectPriority: ProjectPriority;
      items: PendingItem[];
    }
  >();

  for (const item of items) {
    const existing = grouped.get(item.projectId);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    grouped.set(item.projectId, {
      projectName: item.projectName,
      projectPriority: item.projectPriority,
      items: [item],
    });
  }

  return [...grouped.values()]
    .sort((a, b) => priorityRank[a.projectPriority] - priorityRank[b.projectPriority])
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
    }));
}
