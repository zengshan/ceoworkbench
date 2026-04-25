import type { EntityId, Run } from '../../core/src';
import type { Storage } from '../../storage/src';
import type { AgentContext } from './agent-adapter';

export async function buildAgentContext(storage: Storage, run: Run): Promise<AgentContext> {
  const [messages, recentEvents, tasks, artifacts, memoryEntries] = await Promise.all([
    storage.listMessages(run.companyId),
    storage.listEvents(run.companyId),
    storage.listTasks(run.companyId),
    storage.listArtifacts(run.companyId),
    storage.listMemoryEntries(run.companyId),
  ]);

  return {
    run,
    messages: messages.filter((message) => isRelevantMessage(message.agentId, run.agentId)),
    recentEvents: recentEvents.slice(-50),
    activeTasks: tasks.filter((task) => task.status !== 'completed' && task.status !== 'failed'),
    artifacts: artifacts.slice(-20),
    memoryEntries: memoryEntries.slice(-20),
  };
}

function isRelevantMessage(agentId: EntityId | undefined, runAgentId: EntityId) {
  return !agentId || agentId === runAgentId;
}
