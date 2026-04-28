import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SandboxRunInput, SandboxRuntime } from '../../sandbox-podman/src';
import { createCliRuntime, runCli } from './commands';

const missingConfigPath = path.join(tmpdir(), 'ceoworkbench-test-missing-local.env');

const fakeEnv = {
  CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
  CEOWORKBENCH_AGENT_ADAPTER: 'fake',
};

function createFakeCliRuntime(options: Parameters<typeof createCliRuntime>[1] = {}) {
  return createCliRuntime(undefined, {
    ...options,
    env: {
      ...fakeEnv,
      ...options.env,
    },
  });
}

describe('ceoworkbench CLI commands', () => {
  it('requires LLM adapter configuration instead of defaulting to fake manager', () => {
    expect(() => createCliRuntime(undefined, {
      env: {
        CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
      },
    })).toThrow(
      'CEO Workbench requires an LLM agent adapter',
    );
  });

  it('loads local env config and lets process env override config values', async () => {
    const configRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-config-'));
    const configPath = path.join(configRoot, 'local.env');
    const sandboxRoot = path.join(configRoot, 'sandbox');
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

    await writeFile(configPath, [
      'export CEOWORKBENCH_AGENT_ADAPTER=sandbox-json',
      'CEOWORKBENCH_RUNNER_ADAPTER=openai-responses',
      'CEOWORKBENCH_AGENT_MODEL=gpt-from-file',
      'OPENAI_API_KEY=sk-from-file',
      '',
    ].join('\n'), 'utf8');

    const runtime = createCliRuntime(undefined, {
      env: {
        CEOWORKBENCH_CONFIG_PATH: configPath,
        CEOWORKBENCH_SANDBOX_ROOT: sandboxRoot,
        CEOWORKBENCH_AGENT_MODEL: 'gpt-from-env',
      },
      sandboxRuntime,
    });

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '请拆解小说出版项目'], runtime);
    await runCli(['start', '--once'], runtime);

    expect(inputs[0].profile.env).toEqual({
      CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
      CEOWORKBENCH_AGENT_MODEL: 'gpt-from-env',
      OPENAI_API_KEY: 'sk-from-file',
    });
  });

  it('runs the M2 fake manager loop from command calls', async () => {
    const runtime = createFakeCliRuntime();

    expect(await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime)).toContain('Created company novel');
    expect(await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime)).toContain('Created agent manager');
    expect(await runCli(['send', 'manager', '请拆解小说出版项目'], runtime)).toContain('Queued ceo_steer run');
    expect(await runCli(['start', '--once'], runtime)).toContain('Processed run');

    const watchOutput = await runCli(['watch'], runtime);
    const statusOutput = await runCli(['status'], runtime);
    const teamOutput = await runCli(['team'], runtime);
    const briefingOutput = await runCli(['briefing'], runtime);
    const timelineOutput = await runCli(['timeline'], runtime);
    const artifactReport = await runCli(['report', '--artifacts'], runtime);
    const markdownReport = await runCli(['report', '--format', 'markdown'], runtime);

    expect(watchOutput).toContain('run_completed');
    expect(statusOutput).toContain('Company status: novel');
    expect(teamOutput).toContain('Team members');
    expect(teamOutput).toContain('manager');
    expect(briefingOutput).toContain('CEO 简报');
    expect(briefingOutput).toContain('关键突破');
    expect(timelineOutput).toContain('公司时间线');
    expect(timelineOutput).toContain('manager 开始工作');
    expect(artifactReport).toContain('project-plan.md');
    expect(markdownReport).toContain('# Run summary:');
  });

  it('reports and resolves pending CEO decisions', async () => {
    const runtime = createFakeCliRuntime();

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
    const runtime = createFakeCliRuntime();

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '第一轮拆解'], runtime);
    await runCli(['send', 'manager', '第二轮拆解'], runtime);

    const output = await runCli(['start', '--max-ticks', '2'], runtime);
    const runs = await runtime.storage.listRuns('company-000001');

    expect(output).toBe('Processed 2 runs.');
    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(2);
  });

  it('recovers failed runs by requeueing them for work', async () => {
    const runtime = createFakeCliRuntime();

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '第一轮拆解'], runtime);
    await runtime.storage.failRun('run-000005', 'Sandbox timed out', runtime.clock.now());

    const output = await runCli(['recover'], runtime);
    const runs = await runtime.storage.listRuns('company-000001');

    expect(output).toBe('Recovered 1 failed run.');
    expect(runs[0]).toMatchObject({
      id: 'run-000005',
      status: 'queued',
      attempt: 1,
      errorMessage: undefined,
    });
  });

  it('runs work until idle by default and streams execution progress', async () => {
    const runtime = createFakeCliRuntime();
    const progress: string[] = [];

    await runCli(['company', 'init', 'historical-novel', '--goal', '创作一部历史小说'], runtime);
    await runCli(['ceo', '我要创作一部历史小说'], runtime);

    const output = await runCli(['work'], runtime, { onProgress: (line) => progress.push(line) });
    const runs = await runtime.storage.listRuns('company-000001');

    expect(output).toContain('Processed 9 runs.');
    expect(progress.some((line) => line.includes('[work] start') && line.includes('manager'))).toBe(true);
    expect(progress.some((line) => line.includes('[work] waiting for agent output'))).toBe(true);
    expect(progress.some((line) => line.includes('Manager acknowledged the CEO steer'))).toBe(true);
    expect(progress.some((line) => line.includes('created task: Draft project decomposition'))).toBe(true);
    expect(progress.some((line) => line.includes('created artifact: artifacts/'))).toBe(true);
    expect(progress.some((line) => line.includes('created review report:'))).toBe(true);
    expect(progress.some((line) => line.includes('[work] finished'))).toBe(true);
    expect(runs.filter((run) => run.status === 'queued')).toHaveLength(0);
  });

  it('keeps single-run work available behind an explicit once flag', async () => {
    const runtime = createFakeCliRuntime();

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '第一轮拆解'], runtime);
    await runCli(['send', 'manager', '第二轮拆解'], runtime);

    const output = await runCli(['work', '--once'], runtime);
    const runs = await runtime.storage.listRuns('company-000001');

    expect(output).toContain('Processed 1 run.');
    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(1);
    expect(runs.filter((run) => run.status === 'queued')).toHaveLength(1);
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
        CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
        CEOWORKBENCH_AGENT_ADAPTER: 'sandbox-json',
        CEOWORKBENCH_SANDBOX_ROOT: sandboxRoot,
        CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
        OPENAI_API_KEY: 'sk-test',
      },
      sandboxRuntime,
    });

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '请拆解小说出版项目'], runtime);
    await runCli(['start', '--once'], runtime);

    const contextPath = path.join(sandboxRoot, 'company-000001', 'runs', 'run-000005', 'home', 'context.json');
    const context = JSON.parse(await readFile(contextPath, 'utf8'));

    expect(inputs[0].command).toEqual(['/home/agent/context.json', '/home/agent/result.json']);
    expect(inputs[0].profile.network).toBe('slirp4netns');
    expect(inputs[0].profile.homeMount.hostPath).toBe(path.dirname(contextPath));
    expect(context.run.id).toBe('run-000005');
    expect(context.messages[0].content).toBe('请拆解小说出版项目');
  });

  it('enables network and forwards only runner env when sandboxed OpenAI runner is requested', async () => {
    const sandboxRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-sandbox-openai-'));
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
        CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
        CEOWORKBENCH_AGENT_ADAPTER: 'sandbox-json',
        CEOWORKBENCH_SANDBOX_ROOT: sandboxRoot,
        CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
        CEOWORKBENCH_AGENT_MODEL: 'gpt-5.4',
        OPENAI_API_KEY: 'sk-test',
        UNRELATED_SECRET: 'must-not-enter-sandbox',
      },
      sandboxRuntime,
    });

    await runCli(['company', 'create', 'novel', '--goal', 'Publish a novel'], runtime);
    await runCli(['agent', 'create', 'manager', '--role', 'manager'], runtime);
    await runCli(['send', 'manager', '请拆解小说出版项目'], runtime);
    await runCli(['start', '--once'], runtime);

    expect(inputs[0].profile.network).toBe('slirp4netns');
    expect(inputs[0].profile.limits?.timeoutSeconds).toBe(180);
    expect(inputs[0].profile.env).toEqual({
      CEOWORKBENCH_RUNNER_ADAPTER: 'openai-responses',
      CEOWORKBENCH_AGENT_MODEL: 'gpt-5.4',
      OPENAI_API_KEY: 'sk-test',
    });
  });

  it('supports the CEO-first workflow and shows artifact content', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-workspace-'));
    const runtime = createCliRuntime(undefined, {
      env: {
        CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
        CEOWORKBENCH_WORKSPACE_ROOT: workspaceRoot,
        CEOWORKBENCH_AGENT_ADAPTER: 'fake',
      },
    });

    expect(await runCli(['company', 'init', 'novel', '--goal', '完成一部 12 万字科幻小说出版包'], runtime)).toContain('Initialized company novel');
    expect(await runCli(['ceo', '请总经理拆解第一阶段工作'], runtime)).toContain('Queued ceo_steer run for manager');
    expect(await runCli(['work', '--until-idle'], runtime)).toContain('Processed 1 run.');

    const briefing = await runCli(['briefing'], runtime);
    const artifacts = await runCli(['artifact', 'list'], runtime);
    const latestArtifact = await runCli(['artifact', 'show', 'latest'], runtime);

    expect(briefing).toContain('CEO 简报');
    expect(artifacts).toContain('project-plan.md');
    expect(latestArtifact).toContain('# Project plan draft');
    expect(latestArtifact).toContain('请总经理拆解第一阶段工作');
  });

  it('persists default CLI state across runtime instances', async () => {
    const stateRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-state-'));
    const env = {
      CEOWORKBENCH_CONFIG_PATH: missingConfigPath,
      CEOWORKBENCH_STATE_PATH: path.join(stateRoot, 'state.json'),
      CEOWORKBENCH_WORKSPACE_ROOT: path.join(stateRoot, 'workspaces'),
      CEOWORKBENCH_AGENT_ADAPTER: 'fake',
    };
    const firstRuntime = createCliRuntime(undefined, { env });

    await runCli(['company', 'init', 'novel', '--goal', 'Publish a novel'], firstRuntime);

    const secondRuntime = createCliRuntime(undefined, { env });

    expect(await runCli(['status'], secondRuntime)).toContain('Company status: novel');
    expect(await runCli(['team'], secondRuntime)).toContain('manager');
  });

  it('queues exact multiline CEO content from a message file', async () => {
    const runtime = createFakeCliRuntime();
    const messageRoot = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-message-'));
    const messagePath = path.join(messageRoot, 'message.txt');
    const message = 'Line one\nLine "two" with spaces';

    await writeFile(messagePath, message, 'utf8');
    await runCli(['company', 'init', 'novel', '--goal', 'Publish a novel'], runtime);

    expect(await runCli(['ceo', '--message-file', messagePath], runtime)).toContain('Queued ceo_steer run for manager');

    const messages = await runtime.storage.listMessages('company-000001');
    expect(messages.at(-1)?.content).toBe(message);
  });

  it('lists wizard in help output', async () => {
    expect(await runCli(['help'], createFakeCliRuntime())).toContain('ceoworkbench wizard');
  });

  it('lets the manager auto-staff specialist workers for a historical novel goal', async () => {
    const runtime = createFakeCliRuntime();

    await runCli(['company', 'init', 'historical-novel', '--goal', '创作一部历史小说'], runtime);
    await runCli(['ceo', '我要创作一部历史小说'], runtime);

    expect(await runCli(['work', '--until-idle'], runtime)).toContain('Processed 9 runs.');

    const agents = await runtime.storage.listAgents('company-000001');
    const runs = await runtime.storage.listRuns('company-000001');
    const teamOutput = await runCli(['team'], runtime);
    const watchOutput = await runCli(['watch'], runtime);
    const timelineOutput = await runCli(['timeline'], runtime);

    expect(agents.map((agent) => agent.name)).toEqual([
      'manager',
      'researcher',
      'architect',
      'writer',
      'editor',
      'markdown-reviewer',
    ]);
    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(9);
    expect(teamOutput).toContain('researcher');
    expect(teamOutput).toContain('writer');
    expect(watchOutput).toContain('agent_created');
    expect(watchOutput).toContain('run_started');
    expect(timelineOutput).toContain('architect 产出');
    expect(timelineOutput).toContain('entered review');
    expect(timelineOutput).toContain('markdown-reviewer 创建评审报告');
  });
});
