import { describe, expect, it } from 'vitest';
import { buildPodmanCommand } from './podman-command';
import { defaultSandboxProfile } from './sandbox-profile';

describe('buildPodmanCommand', () => {
  it('builds a rootless, read-only, no-network default sandbox command', () => {
    const command = buildPodmanCommand({
      runId: 'run-123',
      command: ['node', '/runner/step.js'],
      profile: defaultSandboxProfile({
        image: 'agent-image:latest',
        workspaceMount: {
          hostPath: '/srv/companies/company-1/workspace',
          containerPath: '/workspace',
        },
        homeMount: {
          hostPath: '/srv/companies/company-1/runs/run-123/home',
          containerPath: '/home/agent',
        },
      }),
    });

    expect(command.command).toBe('podman');
    expect(command.args).toEqual(expect.arrayContaining([
      'run',
      '--rm',
      '--userns',
      'keep-id',
      '--network',
      'none',
      '--read-only',
      '--cpus',
      '1',
      '--memory',
      '1g',
      '--pids-limit',
      '256',
      '--volume',
      '/srv/companies/company-1/workspace:/workspace:rw',
      '--volume',
      '/srv/companies/company-1/runs/run-123/home:/home/agent:rw',
      'agent-image:latest',
      'node',
      '/runner/step.js',
    ]));
  });

  it('supports readonly extra mounts and explicit env allowlist', () => {
    const command = buildPodmanCommand({
      runId: 'run-456',
      command: ['printenv', 'MODEL'],
      profile: defaultSandboxProfile({
        workspaceMount: {
          hostPath: '/workspace',
          containerPath: '/workspace',
        },
        homeMount: {
          hostPath: '/home/run',
          containerPath: '/home/agent',
        },
        extraMounts: [
          {
            hostPath: '/srv/shared/skills',
            containerPath: '/skills',
            readonly: true,
          },
        ],
        env: {
          MODEL: 'fake-manager',
        },
      }),
    });

    expect(command.args).toEqual(expect.arrayContaining([
      '--volume',
      '/srv/shared/skills:/skills:ro',
      '--env',
      'MODEL=fake-manager',
    ]));
    expect(command.args).not.toContain('/var/run/docker.sock');
    expect(command.args).not.toContain('/run/podman/podman.sock');
  });

  it('rejects container runtime socket mounts', () => {
    expect(() => buildPodmanCommand({
      runId: 'run-789',
      command: ['node', '/runner/step.js'],
      profile: defaultSandboxProfile({
        workspaceMount: {
          hostPath: '/workspace',
          containerPath: '/workspace',
        },
        homeMount: {
          hostPath: '/home/run',
          containerPath: '/home/agent',
        },
        extraMounts: [
          {
            hostPath: '/run/podman/podman.sock',
            containerPath: '/run/podman/podman.sock',
          },
        ],
      }),
    })).toThrow('Refusing to mount container runtime socket');
  });
});
