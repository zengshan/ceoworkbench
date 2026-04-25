import type { SandboxProfile, SandboxRuntime } from '../../sandbox-podman/src';
import type { AgentAdapter, AgentContext, AgentStepResult } from './agent-adapter';

export type SandboxedJsonAgentAdapterOptions = {
  runtime: SandboxRuntime;
  profileForContext: (context: AgentContext) => SandboxProfile;
  commandForContext: (context: AgentContext) => string[];
};

export class SandboxedJsonAgentAdapter implements AgentAdapter {
  constructor(private readonly options: SandboxedJsonAgentAdapterOptions) {}

  async runStep(context: AgentContext): Promise<AgentStepResult> {
    const result = await this.options.runtime.run({
      runId: context.run.id,
      command: this.options.commandForContext(context),
      profile: this.options.profileForContext(context),
    });

    if (result.timedOut) {
      throw new Error(`Sandbox timed out for run ${context.run.id}`);
    }

    if (result.exitCode !== 0) {
      throw new Error(`Sandbox exited with code ${result.exitCode} for run ${context.run.id}: ${result.stderr}`);
    }

    try {
      return JSON.parse(result.stdout) as AgentStepResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new Error(`Sandbox returned invalid JSON for run ${context.run.id}: ${message}`);
    }
  }
}
