import { OpenAIResponsesAgentAdapter } from '../../agent-openai/src';
import { FakeManagerAdapter, type AgentAdapter } from '../../runtime/src';

export type AgentRunnerEnv = Record<string, string | undefined>;

export function createAgentRunnerAdapter(env: AgentRunnerEnv = process.env): AgentAdapter {
  const adapter = env.CEOWORKBENCH_RUNNER_ADAPTER ?? 'fake-manager';

  if (adapter === 'fake-manager') {
    return new FakeManagerAdapter();
  }

  if (adapter === 'openai-responses') {
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required when CEOWORKBENCH_RUNNER_ADAPTER=openai-responses.');
    }

    return new OpenAIResponsesAgentAdapter({
      apiKey,
      model: env.CEOWORKBENCH_AGENT_MODEL ?? 'gpt-5.2',
      baseUrl: env.OPENAI_BASE_URL,
    });
  }

  throw new Error(`Unknown CEOWORKBENCH_RUNNER_ADAPTER: ${adapter}`);
}
