import { describe, expect, it } from 'vitest';
import type { Artifact, Company, Message, Task } from '../../core/src';
import { MemoryStorage } from '../../storage/src';
import { buildReviewContext } from './review-context-builder';

const now = '2026-04-27T00:00:00.000Z';

const company: Company = {
  id: 'company-1',
  name: 'acme',
  goal: 'Ship a reviewed operating workflow',
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

const task: Task = {
  id: 'task-1',
  companyId: company.id,
  assignedAgentId: 'agent-worker',
  title: 'Draft review protocol',
  objective: 'Define deterministic review routing.',
  expectedOutput: 'A protocol note with reviewer matching and revision rules.',
  status: 'submitted',
  priority: 50,
  dependencyTaskIds: [],
  inputArtifactIds: [],
  outputArtifactIds: ['artifact-1'],
  requiresReview: true,
  createdAt: now,
  updatedAt: now,
};

const artifact: Artifact = {
  id: 'artifact-1',
  companyId: company.id,
  runId: 'run-worker',
  agentId: 'agent-worker',
  taskId: task.id,
  path: 'artifacts/review-protocol.md',
  title: 'Review protocol draft',
  artifactType: 'markdown',
  status: 'submitted',
  content: 'The worker says the implementation is complete.',
  createdAt: now,
  updatedAt: now,
};

const workerMessage: Message = {
  id: 'message-worker',
  companyId: company.id,
  agentId: 'agent-worker',
  author: 'agent',
  kind: 'follow_up',
  content: 'Internal process note: trust me, the shortcut is fine.',
  createdAt: now,
};

describe('buildReviewContext', () => {
  it('builds a minimal allowlisted context for reviewer agents', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createTask(task);
    await storage.createArtifact(artifact);
    await storage.appendMessage(workerMessage);

    const context = await buildReviewContext(storage, {
      companyId: company.id,
      taskId: task.id,
      artifactId: artifact.id,
      charter: 'Review is a runtime protocol; normal verdicts are consumed by supervisor.',
      acceptanceCriteria: [
        'Reviewer selection is deterministic.',
        'Worker process messages are not part of review input.',
      ],
      revisionRound: 2,
      priorFindings: [
        {
          id: 'F101',
          severity: 'blocker',
          location: 'review-protocol.test.ts',
          description: 'Missing stable hash determinism coverage.',
          mustAddress: true,
        },
        {
          id: 'F102',
          severity: 'minor',
          location: 'review-protocol.ts',
          description: 'Naming can be tighter.',
          mustAddress: false,
        },
      ],
    });

    expect(Object.keys(context).sort()).toEqual([
      'acceptanceCriteria',
      'artifact',
      'charter',
      'priorReview',
      'task',
    ]);
    expect(Object.keys(context.task).sort()).toEqual([
      'expectedOutput',
      'id',
      'objective',
      'title',
    ]);
    expect(Object.keys(context.artifact).sort()).toEqual([
      'artifactType',
      'content',
      'id',
      'path',
      'status',
      'title',
    ]);

    expect(context).toEqual({
      charter: 'Review is a runtime protocol; normal verdicts are consumed by supervisor.',
      task: {
        id: 'task-1',
        title: 'Draft review protocol',
        objective: 'Define deterministic review routing.',
        expectedOutput: 'A protocol note with reviewer matching and revision rules.',
      },
      artifact: {
        id: 'artifact-1',
        path: 'artifacts/review-protocol.md',
        title: 'Review protocol draft',
        artifactType: 'markdown',
        status: 'submitted',
        content: 'The worker says the implementation is complete.',
      },
      acceptanceCriteria: [
        'Reviewer selection is deterministic.',
        'Worker process messages are not part of review input.',
      ],
      priorReview: {
        revisionRound: 2,
        mustAddressFindings: [
          {
            id: 'F101',
            severity: 'blocker',
            location: 'review-protocol.test.ts',
            description: 'Missing stable hash determinism coverage.',
            mustAddress: true,
          },
        ],
        optionalFindings: [
          {
            id: 'F102',
            severity: 'minor',
            location: 'review-protocol.ts',
            description: 'Naming can be tighter.',
            mustAddress: false,
          },
        ],
      },
    });
  });
});
