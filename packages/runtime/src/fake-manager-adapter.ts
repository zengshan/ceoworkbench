import type {
  AgentRunEvent,
} from './internal-types';
import type { AgentAdapter, AgentContext, AgentStepResult } from './agent-adapter';

export class FakeManagerAdapter implements AgentAdapter {
  async runStep(context: AgentContext): Promise<AgentStepResult> {
    const now = new Date().toISOString();
    const latestMessage = context.messages.at(-1);
    const messageText = latestMessage?.content ?? 'No CEO message provided.';
    const basePayload = {
      source: 'fake-manager',
      message: messageText,
    };

    const events: AgentRunEvent[] = [
      {
        id: `${context.run.id}-ack`,
        companyId: context.run.companyId,
        runId: context.run.id,
        agentId: context.run.agentId,
        type: 'agent_event_emitted',
        payload: {
          ...basePayload,
          eventKind: 'ack',
          text: 'Manager acknowledged the CEO steer and started decomposition.',
        },
        createdAt: now,
      },
      {
        id: `${context.run.id}-progress`,
        companyId: context.run.companyId,
        runId: context.run.id,
        agentId: context.run.agentId,
        type: 'agent_event_emitted',
        payload: {
          ...basePayload,
          eventKind: 'progress',
          text: 'Manager created the first planning task and artifact.',
        },
        createdAt: now,
      },
    ];

    return {
      events,
      tasks: [
        {
          id: `${context.run.id}-task-plan`,
          companyId: context.run.companyId,
          assignedAgentId: context.run.agentId,
          title: 'Draft project decomposition',
          objective: `Break down CEO steer: ${messageText}`,
          expectedOutput: 'A project plan with phases, artifacts, and decision points.',
          status: 'submitted',
          priority: context.run.priority,
          dependencyTaskIds: [],
          inputArtifactIds: [],
          outputArtifactIds: [`${context.run.id}-artifact-plan`],
          requiresReview: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      artifacts: [
        {
          id: `${context.run.id}-artifact-plan`,
          companyId: context.run.companyId,
          runId: context.run.id,
          agentId: context.run.agentId,
          taskId: `${context.run.id}-task-plan`,
          path: `artifacts/${context.run.id}/project-plan.md`,
          title: 'Project plan draft',
          artifactType: 'markdown',
          status: 'submitted',
          createdAt: now,
          updatedAt: now,
        },
      ],
      memoryEntries: [
        {
          id: `${context.run.id}-memory-goal`,
          companyId: context.run.companyId,
          kind: 'goal',
          title: 'Latest CEO steer',
          content: messageText,
          sourceRunId: context.run.id,
          sourceMessageId: latestMessage?.id,
          createdAt: now,
        },
      ],
    };
  }
}
