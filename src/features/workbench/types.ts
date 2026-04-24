export type RailSectionKey = 'manager' | 'departments' | 'pending' | 'archive';
export type ItemSeverity = 'light' | 'medium' | 'heavy';
export type ProjectPriority = 'P0' | 'P1' | 'P2';
export type OversightMode = 'normal' | 'watch' | 'critical';
export type WorkspaceView = 'conversations' | 'team';
export type LeftRailView = WorkspaceView;

export type WorkspaceUnreadBadge = {
  count: number;
  hasAttention: boolean;
};

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

export type TeamAgent = {
  id: string;
  name: string;
  title?: string;
};

export type TeamDepartment = {
  id: string;
  name: string;
  summary: string;
  agents: TeamAgent[];
};

export type StageLayerId = 'ceo' | 'design' | 'engineering';
export type StageCardTone = 'paper' | 'accent' | 'warning';
export type StageFocusId = 'ceo' | 'office' | 'design' | 'engineering';
export type StageClusterCardSize = 'focused' | 'supporting' | 'compressed';

export type StageCardRecord = {
  id: string;
  title: string;
  body: string;
  owner: string;
  updatedAt: string;
  statusLabel?: string;
  artifactLabels?: string[];
  position: {
    x: number;
    y: number;
    w: number;
  };
  rotation?: number;
  tone?: StageCardTone;
};

export type StageClusterCardRecord = {
  id: string;
  title: string;
  body: string;
  owner: string;
  updatedAt: string;
  statusLabel?: string;
  artifactLabels?: string[];
  tone?: StageCardTone;
  rotation?: number;
  sizeHint?: StageClusterCardSize;
};

export type StageClusterLayout = {
  x: number;
  y: number;
  w: number;
  z: number;
  mode: 'focused' | 'supporting' | 'compressed';
};

export type StageClusterConnection = {
  id: string;
  fromClusterId: StageFocusId;
  toClusterId: StageFocusId;
  fromCardId?: string;
  toCardId?: string;
  label?: string;
};

export type StageCluster = {
  id: StageFocusId;
  label: string;
  switcherLabel: string;
  cards: StageClusterCardRecord[];
  layoutsByFocus: Record<StageFocusId, StageClusterLayout>;
};

export type StageSceneRecord = {
  focusOrder: StageFocusId[];
  clusters: StageCluster[];
  connections: StageClusterConnection[];
};

export type StageConnection = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type StageLayer = {
  id: StageLayerId;
  label: string;
  description: string;
  cards: StageCardRecord[];
  connections: StageConnection[];
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
