import { describe, expect, it } from 'vitest';
import type { RunEvent } from '../../core/src';
import type { SandboxRuntime } from '../../sandbox-podman/src';
import { SandboxedJsonAgentAdapter } from './sandboxed-json-agent-adapter';
import type { AgentContext, AgentStepResult } from './agent-adapter';

const context: AgentContext = {
  run: {
    id: 'run-1',
    companyId: 'company-1',
    agentId: 'agent-1',
    kind: 'ceo_steer',
    status: 'running',
    priority: 100,
    attempt: 0,
    maxAttempts: 3,
    queuedAt: '2026-04-25T00:00:00.000Z',
  },
  messages: [],
  recentEvents: [],
  activeTasks: [],
  artifacts: [],
  memoryEntries: [],
};

const agentEvent: RunEvent = {
  id: 'event-1',
  companyId: 'company-1',
  runId: 'run-1',
  agentId: 'agent-1',
  type: 'agent_event_emitted',
  payload: { message: 'planned' },
  createdAt: '2026-04-25T00:00:00.000Z',
};

describe('SandboxedJsonAgentAdapter', () => {
  it('runs an agent step inside the configured sandbox and parses its JSON result', async () => {
    const result: AgentStepResult = { events: [agentEvent] };
    const runtime: SandboxRuntime = {
      async run(input) {
        expect(input.runId).toBe('run-1');
        expect(input.command).toEqual(['node', '/runner/agent.js', 'run-1']);
        expect(input.profile.image).toBe('ceoworkbench-agent:latest');
        return {
          exitCode: 0,
          stdout: JSON.stringify(result),
          stderr: '',
          timedOut: false,
        };
      },
    };
    const adapter = new SandboxedJsonAgentAdapter({
      runtime,
      profileForContext: () => ({
        image: 'ceoworkbench-agent:latest',
        workspaceMount: { hostPath: '/srv/company/workspace', containerPath: '/workspace' },
        homeMount: { hostPath: '/srv/company/runs/run-1/home', containerPath: '/home/agent' },
      }),
      commandForContext: (agentContext) => ['node', '/runner/agent.js', agentContext.run.id],
    });

    await expect(adapter.runStep(context)).resolves.toEqual(result);
  });

  it('fails the run when the sandbox times out', async () => {
    const runtime: SandboxRuntime = {
      async run() {
        return {
          exitCode: null,
          stdout: '',
          stderr: 'killed',
          timedOut: true,
        };
      },
    };
    const adapter = new SandboxedJsonAgentAdapter({
      runtime,
      profileForContext: () => ({
        image: 'ceoworkbench-agent:latest',
        workspaceMount: { hostPath: '/srv/company/workspace', containerPath: '/workspace' },
        homeMount: { hostPath: '/srv/company/runs/run-1/home', containerPath: '/home/agent' },
      }),
      commandForContext: () => ['node', '/runner/agent.js'],
    });

    await expect(adapter.runStep(context)).rejects.toThrow('Sandbox timed out for run run-1');
  });

  it('fails the run when the sandbox output is not a JSON agent result', async () => {
    const runtime: SandboxRuntime = {
      async run() {
        return {
          exitCode: 0,
          stdout: 'not json',
          stderr: '',
          timedOut: false,
        };
      },
    };
    const adapter = new SandboxedJsonAgentAdapter({
      runtime,
      profileForContext: () => ({
        image: 'ceoworkbench-agent:latest',
        workspaceMount: { hostPath: '/srv/company/workspace', containerPath: '/workspace' },
        homeMount: { hostPath: '/srv/company/runs/run-1/home', containerPath: '/home/agent' },
      }),
      commandForContext: () => ['node', '/runner/agent.js'],
    });

    await expect(adapter.runStep(context)).rejects.toThrow('Sandbox returned invalid JSON for run run-1');
  });
});
