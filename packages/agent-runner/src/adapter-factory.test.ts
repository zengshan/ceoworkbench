import { describe, expect, it } from 'vitest';
import { OpenAIResponsesAgentAdapter } from '../../agent-openai/src';
import { FakeManagerAdapter } from '../../runtime/src';
import { createAgentRunnerAdapter } from './adapter-factory';

describe('createAgentRunnerAdapter', () => {
  it('uses the fake manager adapter by default', () => {
    const adapter = createAgentRunnerAdapter({});

    expect(adapter).toBeInstanceOf(FakeManagerAdapter);
  });

  it('creates an OpenAI Responses adapter when requested', () => {
    const adapter = createAgentRunnerAdapter({
      CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
      OPENAI_API_KEY: 'test-key',
      CEOWORKBENCH_AGENT_MODEL: 'gpt-5.2',
    });

    expect(adapter).toBeInstanceOf(OpenAIResponsesAgentAdapter);
  });

  it('requires an API key for OpenAI Responses adapter', () => {
    expect(() => createAgentRunnerAdapter({
      CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
    })).toThrow('OPENAI_API_KEY is required');
  });
});
