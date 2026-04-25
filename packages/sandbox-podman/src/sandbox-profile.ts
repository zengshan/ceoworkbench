export type SandboxNetworkMode = 'none' | 'slirp4netns';

export type SandboxMount = {
  hostPath: string;
  containerPath: string;
  readonly?: boolean;
};

export type SandboxResourceLimits = {
  cpus?: string;
  memory?: string;
  pidsLimit?: number;
  timeoutSeconds?: number;
};

export type SandboxProfile = {
  image: string;
  workspaceMount: SandboxMount;
  homeMount: SandboxMount;
  extraMounts?: SandboxMount[];
  network?: SandboxNetworkMode;
  readOnlyRoot?: boolean;
  userns?: 'keep-id' | 'auto';
  workdir?: string;
  env?: Record<string, string>;
  limits?: SandboxResourceLimits;
};

export type SandboxRunInput = {
  runId: string;
  command: string[];
  profile: SandboxProfile;
};

export type SandboxRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type SandboxRuntime = {
  run(input: SandboxRunInput): Promise<SandboxRunResult>;
};

export function defaultSandboxProfile(overrides: Partial<SandboxProfile> & Pick<SandboxProfile, 'workspaceMount' | 'homeMount'>): SandboxProfile {
  return {
    image: 'ceoworkbench-agent:latest',
    network: 'none',
    readOnlyRoot: true,
    userns: 'keep-id',
    workdir: '/workspace',
    env: {},
    limits: {
      cpus: '1',
      memory: '1g',
      pidsLimit: 256,
      timeoutSeconds: 60,
    },
    ...overrides,
  };
}
