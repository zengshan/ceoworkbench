import { createAgentRunnerAdapter, type AgentRunnerEnv } from './adapter-factory';
import { runJsonAgentStep } from './json-runner';

export async function runAgentRunnerCli(args: string[], env: AgentRunnerEnv = process.env) {
  const [contextPath, resultPath] = args;

  if (!contextPath || !resultPath) {
    throw new Error('Usage: agent-runner <context.json> <result.json>');
  }

  await runJsonAgentStep({
    contextPath,
    resultPath,
    adapter: createAgentRunnerAdapter(env),
  });
}
