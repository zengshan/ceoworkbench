import type {
  Artifact,
  DecisionRequest,
  MemoryEntry,
  Message,
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

export type AgentStepResult = {
  events: RunEvent[];
  tasks?: Task[];
  artifacts?: Artifact[];
  memoryEntries?: MemoryEntry[];
  decisionRequests?: DecisionRequest[];
  continuationRequested?: boolean;
  blocked?: boolean;
};

export type AgentAdapter = {
  runStep(context: AgentContext): Promise<AgentStepResult>;
};
