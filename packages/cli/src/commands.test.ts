import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

    expect(inputs[0].command).toEqual(['/home/agent/context.json', '/home/agent/result.json']);
    expect(inputs[0].profile.network).toBe('none');
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
        CEOWORKBENCH_WORKSPACE_ROOT: workspaceRoot,
      },
    });

    expect(await runCli(['company', 'init', 'novel', '--goal', '完成一部 12 万字科幻小说出版包'], runtime)).toContain('Initialized company novel');
    expect(await runCli(['ceo', '请总经理拆解第一阶段工作'], runtime)).toContain('Queued ceo_steer run for manager');
    expect(await runCli(['work', '--until-idle'], runtime)).toContain('Processed 1 runs.');

    const briefing = await runCli(['briefing'], runtime);
    const artifacts = await runCli(['artifact', 'list'], runtime);
    const latestArtifact = await runCli(['artifact', 'show', 'latest'], runtime);

    expect(briefing).toContain('CEO 简报');
    expect(artifacts).toContain('project-plan.md');
    expect(latestArtifact).toContain('# Project plan draft');
    expect(latestArtifact).toContain('请总经理拆解第一阶段工作');
  });

  it('queues exact multiline CEO content from a message file', async () => {
    const runtime = createCliRuntime();
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
    expect(await runCli(['help'])).toContain('ceoworkbench wizard');
  });

  it('lets the manager auto-staff specialist workers for a historical novel goal', async () => {
    const runtime = createCliRuntime();

    await runCli(['company', 'init', 'historical-novel', '--goal', '创作一部历史小说'], runtime);
    await runCli(['ceo', '我要创作一部历史小说'], runtime);

    expect(await runCli(['work', '--until-idle'], runtime)).toContain('Processed 5 runs.');

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
    ]);
    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(5);
    expect(teamOutput).toContain('researcher');
    expect(teamOutput).toContain('writer');
    expect(watchOutput).toContain('agent_created');
    expect(watchOutput).toContain('run_started');
    expect(timelineOutput).toContain('architect 开始工作');
  });
});
