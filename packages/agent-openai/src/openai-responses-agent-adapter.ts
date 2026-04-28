import type { AgentAdapter, AgentContext, AgentStepResult } from '../../runtime/src';

export type OpenAIResponsesAgentAdapterOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type OpenAIErrorResponse = {
  error?: {
    message?: string;
  };
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export class OpenAIResponsesAgentAdapter implements AgentAdapter {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: OpenAIResponsesAgentAdapterOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async runStep(context: AgentContext): Promise<AgentStepResult> {
    const response = await this.fetchFn(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        instructions: buildInstructions(),
        input: [
          {
            role: 'user',
            content: JSON.stringify(context, null, 2),
          },
        ],
        stream: true,
        text: {
          format: agentStepResultFormat(),
        },
      }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed with ${response.status}: ${extractErrorMessage(bodyText)}`);
    }

    const contentType = response.headers.get('Content-Type') ?? '';
    const outputText = contentType.includes('text/event-stream')
      ? extractStreamingOutputText(bodyText)
      : extractOutputText(JSON.parse(bodyText) as OpenAIResponseBody);

    if (!outputText) {
      throw new Error('OpenAI Responses API returned no output_text.');
    }

    try {
      return normalizeAgentStepResult(context, JSON.parse(outputText), outputText);
    } catch {
      return wrapNarrativeOutput(context, outputText);
    }
  }
}

function buildInstructions() {
  return [
    'You are an agent inside CEO Workbench.',
    'Read the provided AgentContext JSON and return only a JSON AgentStepResult.',
    'Do not wrap the response in Markdown.',
    'Use the run id, company id, and agent id from the context when creating records.',
    'Managers may use delegations to create or reuse specialist workers and assign work.',
    'Worker agents should produce artifacts and memoryEntries for their assigned task.',
    'Reviewer agents must return reviewReports that judge the assigned artifact against the task objective, expected output, evidence quality, coherence, and scope fit.',
    'Reviewer agents should not rewrite the artifact; they should emit verdicts, findings, acceptanceCriteriaCheck, confidence, and escalation flags.',
    'Use decisionRequests and blocked only when CEO input is truly required.',
  ].join('\n');
}

function agentStepResultFormat() {
  return {
    type: 'json_schema',
    name: 'agent_step_result',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'events',
        'delegations',
        'tasks',
        'artifacts',
        'memoryEntries',
        'decisionRequests',
        'reviewReports',
        'continuationRequested',
        'blocked',
      ],
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'companyId', 'runId', 'agentId', 'type', 'payload', 'createdAt'],
            properties: {
              id: { type: 'string' },
              companyId: { type: 'string' },
              runId: { type: ['string', 'null'] },
              agentId: { type: ['string', 'null'] },
              type: { type: 'string' },
              payload: {
                type: 'object',
                additionalProperties: false,
                required: ['eventKind', 'text', 'message', 'title', 'path', 'agentName'],
                properties: {
                  eventKind: { type: ['string', 'null'] },
                  text: { type: ['string', 'null'] },
                  message: { type: ['string', 'null'] },
                  title: { type: ['string', 'null'] },
                  path: { type: ['string', 'null'] },
                  agentName: { type: ['string', 'null'] },
                },
              },
              createdAt: { type: 'string' },
            },
          },
        },
        delegations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['agentName', 'role', 'lifecycle', 'capabilities', 'sandboxProfile', 'title', 'objective', 'expectedOutput', 'priority', 'requiresReview'],
            properties: {
              agentName: { type: 'string' },
              role: { type: 'string', enum: ['manager', 'worker', 'reviewer', 'reporter'] },
              lifecycle: { type: 'string', enum: ['on_demand', 'always_on'] },
              capabilities: { type: 'array', items: { type: 'string' } },
              sandboxProfile: { type: 'string' },
              title: { type: 'string' },
              objective: { type: 'string' },
              expectedOutput: { type: 'string' },
              priority: { type: 'number' },
              requiresReview: { type: 'boolean' },
            },
          },
        },
        tasks: { type: 'array', items: taskSchema() },
        artifacts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'companyId', 'runId', 'agentId', 'taskId', 'path', 'title', 'artifactType', 'status', 'content', 'createdAt', 'updatedAt'],
            properties: {
              id: { type: 'string' },
              companyId: { type: 'string' },
              runId: { type: ['string', 'null'] },
              agentId: { type: ['string', 'null'] },
              taskId: { type: ['string', 'null'] },
              path: { type: 'string' },
              title: { type: 'string' },
              artifactType: { type: 'string' },
              status: { type: 'string', enum: ['draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'final'] },
              content: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
        memoryEntries: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'companyId', 'kind', 'title', 'content', 'sourceRunId', 'sourceMessageId', 'sourceReportId', 'createdAt'],
            properties: {
              id: { type: 'string' },
              companyId: { type: 'string' },
              kind: { type: 'string', enum: ['goal', 'decision', 'fact', 'lesson', 'phase_summary', 'project_summary'] },
              title: { type: 'string' },
              content: { type: 'string' },
              sourceRunId: { type: ['string', 'null'] },
              sourceMessageId: { type: ['string', 'null'] },
              sourceReportId: { type: ['string', 'null'] },
              createdAt: { type: 'string' },
            },
          },
        },
        decisionRequests: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'companyId', 'title', 'context', 'options', 'recommendedOptionId', 'impact', 'deadlineAt', 'createdAt'],
            properties: {
              id: { type: 'string' },
              companyId: { type: 'string' },
              title: { type: 'string' },
              context: { type: 'string' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'label', 'tradeoff'],
                  properties: {
                    id: { type: 'string' },
                    label: { type: 'string' },
                    tradeoff: { type: 'string' },
                  },
                },
              },
              recommendedOptionId: { type: ['string', 'null'] },
              impact: { type: 'string' },
              deadlineAt: { type: ['string', 'null'] },
              createdAt: { type: 'string' },
            },
          },
        },
        reviewReports: {
          type: 'array',
          items: reviewReportSchema(),
        },
        continuationRequested: { type: 'boolean' },
        blocked: { type: 'boolean' },
      },
    },
  };
}

function reviewReportSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'artifactId',
      'taskId',
      'verdict',
      'confidence',
      'findings',
      'acceptanceCriteriaCheck',
      'scopeDriftDetected',
      'needsCeoInput',
      'ceoQuestion',
    ],
    properties: {
      artifactId: { type: 'string' },
      taskId: { type: 'string' },
      verdict: { type: 'string', enum: ['accepted', 'needs_revision', 'rejected', 'escalate'] },
      confidence: { type: 'number' },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'severity', 'location', 'description', 'suggestedFix', 'mustAddress'],
          properties: {
            id: { type: 'string' },
            severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
            location: { type: 'string' },
            description: { type: 'string' },
            suggestedFix: { type: ['string', 'null'] },
            mustAddress: { type: 'boolean' },
          },
        },
      },
      acceptanceCriteriaCheck: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['criterion', 'met', 'evidence'],
          properties: {
            criterion: { type: 'string' },
            met: { type: 'boolean' },
            evidence: { type: 'string' },
          },
        },
      },
      scopeDriftDetected: { type: 'boolean' },
      needsCeoInput: { type: 'boolean' },
      ceoQuestion: { type: ['string', 'null'] },
    },
  };
}

function taskSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'companyId', 'assignedAgentId', 'title', 'objective', 'expectedOutput', 'status', 'priority', 'dependencyTaskIds', 'inputArtifactIds', 'outputArtifactIds', 'requiresReview', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string' },
      companyId: { type: 'string' },
      assignedAgentId: { type: ['string', 'null'] },
      title: { type: 'string' },
      objective: { type: 'string' },
      expectedOutput: { type: 'string' },
      status: { type: 'string', enum: ['queued', 'running', 'submitted', 'in_review', 'completed', 'blocked', 'failed', 'escalated'] },
      priority: { type: 'number' },
      dependencyTaskIds: { type: 'array', items: { type: 'string' } },
      inputArtifactIds: { type: 'array', items: { type: 'string' } },
      outputArtifactIds: { type: 'array', items: { type: 'string' } },
      requiresReview: { type: 'boolean' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
  };
}

function extractOutputText(body: OpenAIResponseBody) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text' || content.text)
    ?.text;
}

function extractStreamingOutputText(bodyText: string) {
  let output = '';
  let finalText = '';

  for (const line of bodyText.split('\n')) {
    if (!line.startsWith('data: ')) {
      continue;
    }

    const data = line.slice('data: '.length).trim();

    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const event = JSON.parse(data) as { type?: string; delta?: string; text?: string; output_text?: string };
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        output += event.delta;
      } else if (event.type === 'response.output_text.done' && typeof event.text === 'string') {
        finalText = event.text;
      } else if (!event.type && typeof event.delta === 'string') {
        output += event.delta;
      } else if (!event.type && typeof event.text === 'string') {
        finalText = event.text;
      } else if (!event.type && typeof event.output_text === 'string') {
        finalText = event.output_text;
      }
    } catch {
      // Ignore malformed SSE keepalive or proxy diagnostic lines.
    }
  }

  return output || finalText;
}

function extractErrorMessage(bodyText: string) {
  try {
    const body = JSON.parse(bodyText) as OpenAIErrorResponse;
    return body.error?.message ?? bodyText;
  } catch {
    return bodyText;
  }
}

function normalizeAgentStepResult(context: AgentContext, value: unknown, rawOutput: string): AgentStepResult {
  if (!isRecord(value)) {
    return wrapNarrativeOutput(context, rawOutput);
  }

  if (isPlanningDelegationArray(value.delegations)) {
    return wrapNarrativeOutput(context, rawOutput);
  }

  if (Array.isArray(value.events) || Array.isArray(value.tasks) || Array.isArray(value.artifacts) || Array.isArray(value.delegations)) {
    const normalized = value as AgentStepResult;

    return {
      ...normalized,
      events: normalized.events ?? [],
      blocked: Boolean(normalized.blocked),
    };
  }

  return wrapNarrativeOutput(context, rawOutput);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlanningDelegationArray(value: unknown) {
  return Array.isArray(value)
    && value.some((item) => isRecord(item) && !('agentName' in item) && 'role' in item && 'goal' in item);
}

function wrapNarrativeOutput(context: AgentContext, outputText: string): AgentStepResult {
  const now = new Date().toISOString();
  const planning = parseManagerPlanningOutput(outputText);

  if (planning) {
    return {
      events: [
        {
          id: `${context.run.id}-planning-output`,
          companyId: context.run.companyId,
          runId: context.run.id,
          agentId: context.run.agentId,
          type: 'agent_event_emitted',
          payload: {
            eventKind: 'planning_output',
            text: planning.summary,
          },
          createdAt: now,
        },
      ],
      delegations: planning.delegations.map((delegation, index) => ({
        agentName: delegation.role,
        role: 'worker',
        lifecycle: 'on_demand',
        capabilities: capabilitiesForPlanningRole(delegation.role),
        sandboxProfile: 'podman-default',
        title: delegation.goal,
        objective: delegation.goal,
        expectedOutput: delegation.instructions.join('\n'),
        priority: 50 - index,
        requiresReview: true,
      })),
      artifacts: [
        {
          id: `${context.run.id}-artifact-planning`,
          companyId: context.run.companyId,
          runId: context.run.id,
          agentId: context.run.agentId,
          path: `artifacts/${context.run.id}/manager-planning.json`,
          title: 'Manager planning output',
          artifactType: 'json',
          status: 'submitted',
          content: outputText.trim(),
          createdAt: now,
          updatedAt: now,
        },
      ],
      memoryEntries: [
        {
          id: `${context.run.id}-memory-planning`,
          companyId: context.run.companyId,
          kind: 'phase_summary',
          title: 'Manager planning summary',
          content: planning.summary,
          sourceRunId: context.run.id,
          sourceMessageId: context.messages.at(-1)?.id,
          createdAt: now,
        },
      ],
      blocked: false,
    };
  }

  return {
    events: [
      {
        id: `${context.run.id}-narrative-output`,
        companyId: context.run.companyId,
        runId: context.run.id,
        agentId: context.run.agentId,
        type: 'agent_event_emitted',
        payload: {
          eventKind: 'narrative_output',
          text: 'OpenAI runner returned narrative output; saved it as an artifact.',
        },
        createdAt: now,
      },
    ],
    artifacts: [
      {
        id: `${context.run.id}-artifact-output`,
        companyId: context.run.companyId,
        runId: context.run.id,
        agentId: context.run.agentId,
        path: `artifacts/${context.run.id}/agent-output.md`,
        title: 'Agent output',
        artifactType: 'markdown',
        status: 'submitted',
        content: outputText.trim(),
        createdAt: now,
        updatedAt: now,
      },
    ],
    memoryEntries: [
      {
        id: `${context.run.id}-memory-output`,
        companyId: context.run.companyId,
        kind: 'phase_summary',
        title: 'Latest agent output',
        content: outputText.trim(),
        sourceRunId: context.run.id,
        sourceMessageId: context.messages.at(-1)?.id,
        createdAt: now,
      },
    ],
    blocked: false,
  };
}

type ManagerPlanningOutput = {
  summary: string;
  delegations: Array<{
    role: string;
    goal: string;
    instructions: string[];
  }>;
};

function parseManagerPlanningOutput(outputText: string): ManagerPlanningOutput | null {
  const jsonText = extractFirstJsonObject(outputText);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);

    if (!isRecord(parsed) || !Array.isArray(parsed.delegations)) {
      return null;
    }

    const delegations = parsed.delegations
      .filter(isRecord)
      .map((delegation) => ({
        role: String(delegation.role ?? '').trim(),
        goal: String(delegation.goal ?? '').trim(),
        instructions: Array.isArray(delegation.instructions)
          ? delegation.instructions.map((instruction) => String(instruction)).filter(Boolean)
          : [],
      }))
      .filter((delegation) => delegation.role && delegation.goal);

    if (!delegations.length) {
      return null;
    }

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'Manager produced a planning handoff.',
      delegations,
    };
  } catch {
    return null;
  }
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf('{');

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function capabilitiesForPlanningRole(role: string) {
  if (role === 'researcher') {
    return ['research', 'report'];
  }

  if (role === 'architect') {
    return ['plot', 'structure', 'report'];
  }

  if (role === 'writer') {
    return ['drafting', 'scene-writing'];
  }

  if (role === 'editor') {
    return ['editing', 'review'];
  }

  return ['chat', 'report'];
}
