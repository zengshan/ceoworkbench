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
        input: JSON.stringify(context, null, 2),
      }),
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`OpenAI Responses API failed with ${response.status}: ${extractErrorMessage(bodyText)}`);
    }

    const body = JSON.parse(bodyText) as OpenAIResponseBody;
    const outputText = extractOutputText(body);

    if (!outputText) {
      throw new Error('OpenAI Responses API returned no output_text.');
    }

    try {
      return JSON.parse(outputText) as AgentStepResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new Error(`OpenAI Responses API returned invalid agent JSON: ${message}`);
    }
  }
}

function buildInstructions() {
  return [
    'You are an agent inside CEO Workbench.',
    'Read the provided AgentContext JSON and return only a JSON AgentStepResult.',
    'Do not wrap the response in Markdown.',
    'Use events, tasks, artifacts, memoryEntries, decisionRequests, and blocked according to the runtime schema.',
  ].join('\n');
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

function extractErrorMessage(bodyText: string) {
  try {
    const body = JSON.parse(bodyText) as OpenAIErrorResponse;
    return body.error?.message ?? bodyText;
  } catch {
    return bodyText;
  }
}
