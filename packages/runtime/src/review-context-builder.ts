import type { Artifact, EntityId, ReviewFinding, Task } from '../../core/src';
import type { Storage } from '../../storage/src';

export type ReviewContext = {
  charter: string;
  task: {
    id: EntityId;
    title: string;
    objective: string;
    expectedOutput: string;
  };
  artifact: {
    id: EntityId;
    path: string;
    title: string;
    artifactType: string;
    status: Artifact['status'];
    content?: string;
  };
  acceptanceCriteria: string[];
  priorReview?: {
    revisionRound: number;
    mustAddressFindings: ReviewFinding[];
    optionalFindings: ReviewFinding[];
  };
};

export type BuildReviewContextInput = {
  companyId: EntityId;
  taskId: EntityId;
  artifactId: EntityId;
  charter: string;
  acceptanceCriteria: string[];
  revisionRound?: number;
  priorFindings?: ReviewFinding[];
};

export async function buildReviewContext(storage: Storage, input: BuildReviewContextInput): Promise<ReviewContext> {
  const [tasks, artifacts] = await Promise.all([
    storage.listTasks(input.companyId),
    storage.listArtifacts(input.companyId),
  ]);
  const task = tasks.find((candidate) => candidate.id === input.taskId);
  const artifact = artifacts.find((candidate) => candidate.id === input.artifactId);

  if (!task) {
    throw new Error(`Task not found for review context: ${input.taskId}`);
  }

  if (!artifact) {
    throw new Error(`Artifact not found for review context: ${input.artifactId}`);
  }

  return {
    charter: input.charter,
    task: selectReviewTaskFields(task),
    artifact: selectReviewArtifactFields(artifact),
    acceptanceCriteria: [...input.acceptanceCriteria],
    ...(input.priorFindings || input.revisionRound
      ? { priorReview: buildPriorReview(input.revisionRound ?? 1, input.priorFindings ?? []) }
      : {}),
  };
}

function selectReviewTaskFields(task: Task): ReviewContext['task'] {
  return {
    id: task.id,
    title: task.title,
    objective: task.objective,
    expectedOutput: task.expectedOutput,
  };
}

function selectReviewArtifactFields(artifact: Artifact): ReviewContext['artifact'] {
  return {
    id: artifact.id,
    path: artifact.path,
    title: artifact.title,
    artifactType: artifact.artifactType,
    status: artifact.status,
    content: artifact.content,
  };
}

function buildPriorReview(revisionRound: number, priorFindings: ReviewFinding[]): NonNullable<ReviewContext['priorReview']> {
  return {
    revisionRound,
    mustAddressFindings: priorFindings.filter((finding) => finding.mustAddress),
    optionalFindings: priorFindings.filter((finding) => !finding.mustAddress),
  };
}
