import type {
  AgentLifecycle,
  AgentRole,
  Artifact,
  DecisionRequest,
  MemoryEntry,
  Message,
  ReviewReport,
  Run,
  RunEvent,
  Task,
} from '../../core/src';

export type AgentContext = {
  run: Run;
  messages: Message[];
  recentEvents: RunEvent[];
  activeTasks: Task[];
  artifacts: Artifact[];
  memoryEntries: MemoryEntry[];
};

export type AgentDelegationRequest = {
  agentName: string;
  role?: AgentRole;
  lifecycle?: AgentLifecycle;
  capabilities?: string[];
  sandboxProfile?: string;
  title?: string;
  objective: string;
  expectedOutput: string;
  priority?: number;
  requiresReview?: boolean;
};

export type AgentStepResult = {
  events: RunEvent[];
  delegations?: AgentDelegationRequest[];
  tasks?: Task[];
  artifacts?: Artifact[];
  reviewReports?: ReviewReport[];
  memoryEntries?: MemoryEntry[];
  decisionRequests?: DecisionRequest[];
  continuationRequested?: boolean;
  structuredOutputFallback?: boolean;
  blocked?: boolean;
};

export type AgentAdapter = {
  runStep(context: AgentContext): Promise<AgentStepResult>;
};
