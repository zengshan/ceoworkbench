import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SandboxRunInput, SandboxRuntime } from '../../sandbox-podman/src';
import { createCliRuntime, runCli } from './commands';

describe('ceoworkbench CLI commands', () => {
  it('runs the M2 fake manager loop from command calls', async () => {
    const runtime = createCliRuntime();

    expect(await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime)).toContain('Created company novel');
    expect(await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime)).toContain('Created agent manager');
    expect(await runCli(['send', 'manager', '请拆解小说出版项目'], runtime)).toContain('Queued ceo_steer run');
    expect(await runCli(['start', '--once'], runtime)).toContain('Processed run');

    const watchOutput = await runCli(['watch'], runtime);
    const statusOutput = await runCli(['status'], runtime);
    const artifactReport = await runCli(['report', '--artifacts'], runtime);
    const markdownReport = await runCli(['report', '--format', 'markdown'], runtime);

    expect(watchOutput).toContain('run_completed');
    expect(statusOutput).toContain('Company status: novel');
    expect(artifactReport).toContain('project-plan.md');
    expect(markdownReport).toContain('# Run summary:');
  });

  it('reports and resolves pending CEO decisions', async () => {
    const runtime = createCliRuntime();

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '需要确认小说方向'], runtime);
    await runCli(['start', '--once'], runtime);

    const decisionReport = await runCli(['report', '--decisions'], runtime);
    expect(decisionReport).toContain('Confirm project direction');
    expect(decisionReport).toContain('run-000005-decision-direction');

    const decideOutput = await runCli(['decide', 'run-000005-decision-direction', '--option', 'B'], runtime);
    expect(decideOutput).toContain('Resolved decision run-000005-decision-direction with B');

    const runs = await runtime.storage.listRuns('company-000001');
    expect(runs.at(-1)?.kind).toBe('ceo_decision');
  });

  it('processes multiple queued runs with a bounded scheduler loop', async () => {
    const runtime = createCliRuntime();

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '第一轮拆解'], runtime);
    await runCli(['send', 'manager', '第二轮拆解'], runtime);

    const output = await runCli(['start', '--max-ticks', '2'], runtime);
    const runs = await runtime.storage.listRuns('company-000001');

    expect(output).toBe('Processed 2 runs.');
    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(2);
  });

  it('can run the CLI through the sandbox-json adapter protocol', async () => {
    const sandboxRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-sandbox-'));
    const inputs: SandboxRunInput[] = [];
    const sandboxRuntime: SandboxRuntime = {
      async run(input) {
        inputs.push(input);
        return {
          exitCode: 0,
          stdout: JSON.stringify({ events: [] }),
          stderr: '',
          timedOut: false,
        };
      },
    };
    const runtime = createCliRuntime(undefined, {
      env: {
        CEOWORKBENCH_AGENT_ADAPTER: 'sandbox-json',
        CEOWORKBENCH_SANDBOX_ROOT: sandboxRoot,
      },
      sandboxRuntime,
    });

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '请拆解小说出版项目'], runtime);
    await runCli(['start', '--once'], runtime);

    const contextPath = path.join(sandboxRoot, 'company-000001', 'runs', 'run-000005', 'home', 'context.json');
    const context = JSON.parse(await readFile(contextPath, 'utf8'));

    expect(inputs[0].command).toEqual(['node', '/runner/agent.js', '/home/agent/context.json', '/home/agent/result.json']);
    expect(inputs[0].profile.network).toBe('none');
    expect(inputs[0].profile.homeMount.hostPath).toBe(path.dirname(contextPath));
    expect(context.run.id).toBe('run-000005');
    expect(context.messages[0].content).toBe('请拆解小说出版项目');
  });
});
