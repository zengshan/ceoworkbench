import { readFile, writeFile } from 'node:fs/promises';
import type { AgentAdapter, AgentContext } from '../../runtime/src';

export type JsonAgentRunnerOptions = {
  contextPath: string;
  resultPath: string;
  adapter: AgentAdapter;
};

export async function runJsonAgentStep(options: JsonAgentRunnerOptions) {
  const context = JSON.parse(await readFile(options.contextPath, 'utf8')) as AgentContext;
  const result = await options.adapter.runStep(context);
  await writeFile(options.resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}
