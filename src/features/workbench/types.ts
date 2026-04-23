export type RailSectionKey = 'manager' | 'departments' | 'pending' | 'archive';
export type ItemSeverity = 'light' | 'medium' | 'heavy';
export type ProjectPriority = 'P0' | 'P1' | 'P2';
export type OversightMode = 'normal' | 'watch' | 'critical';

export type RailItem = {
  id: string;
  section: RailSectionKey;
  title: string;
  summary: string;
  statusLabel: string;
  count?: number;
  targetCardId?: string;
};

export type ConversationThread = {
  id: string;
  title: string;
  kind: 'manager' | 'department';
  department?: 'design' | 'engineering';
  lastMessage: string;
  statusLabel: string;
  unreadCount?: number;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  author: string;
  body: string;
  side: 'left' | 'right';
  linkedCardId?: string;
};

export type CanvasLane = 'ceo' | 'manager' | 'design' | 'engineering' | 'decisions';
export type CanvasCardType = 'project' | 'task' | 'deliverable' | 'approval' | 'report';

export type CanvasCardRecord = {
  id: string;
  lane: CanvasLane;
  type: CanvasCardType;
  title: string;
  summary: string;
  owner: string;
  status: string;
  updatedAt: string;
  tags: string[];
  projectId: string;
};

export type PendingItem = {
  id: string;
  projectId: string;
  projectName: string;
  projectPriority: ProjectPriority;
  title: string;
  itemType: 'approval' | 'risk' | 'confirmation';
  severity: ItemSeverity;
  recommendation: string;
  impact: string;
};
