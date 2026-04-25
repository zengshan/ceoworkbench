import type { SandboxProfile, SandboxRuntime } from '../../sandbox-podman/src';
import type { AgentAdapter, AgentContext, AgentStepResult } from './agent-adapter';

export type SandboxedJsonAgentAdapterOptions = {
  runtime: SandboxRuntime;
  profileForContext: (context: AgentContext) => SandboxProfile;
  commandForContext: (context: AgentContext, protocol: SandboxedJsonProtocol) => string[];
  contextPathsForContext?: (context: AgentContext) => SandboxedJsonContextPaths;
  resultPathsForContext?: (context: AgentContext) => SandboxedJsonContextPaths;
  writeContext?: (contextPath: string, context: AgentContext) => Promise<void>;
  readResult?: (resultPath: string) => Promise<string>;
};

export type SandboxedJsonContextPaths = {
  hostPath: string;
  containerPath: string;
};

export type SandboxedJsonProtocol = {
  contextHostPath?: string;
  contextContainerPath?: string;
  resultHostPath?: string;
  resultContainerPath?: string;
};

export class SandboxedJsonAgentAdapter implements AgentAdapter {
  constructor(private readonly options: SandboxedJsonAgentAdapterOptions) {}

  async runStep(context: AgentContext): Promise<AgentStepResult> {
    const contextPaths = this.options.contextPathsForContext?.(context);
    const resultPaths = this.options.resultPathsForContext?.(context);
    const protocol: SandboxedJsonProtocol = {
      contextHostPath: contextPaths?.hostPath,
      contextContainerPath: contextPaths?.containerPath,
      resultHostPath: resultPaths?.hostPath,
      resultContainerPath: resultPaths?.containerPath,
    };

    if (contextPaths && this.options.writeContext) {
      await this.options.writeContext(contextPaths.hostPath, context);
    }

    const result = await this.options.runtime.run({
      runId: context.run.id,
      command: this.options.commandForContext(context, protocol),
      profile: this.options.profileForContext(context),
    });

    if (result.timedOut) {
      throw new Error(`Sandbox timed out for run ${context.run.id}`);
    }

    if (result.exitCode !== 0) {
      throw new Error(`Sandbox exited with code ${result.exitCode} for run ${context.run.id}: ${result.stderr}`);
    }

    const output = result.stdout.trim()
      ? result.stdout
      : resultPaths && this.options.readResult
        ? await this.options.readResult(resultPaths.hostPath)
        : result.stdout;

    try {
      return JSON.parse(output) as AgentStepResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parse error';
      throw new Error(`Sandbox returned invalid JSON for run ${context.run.id}: ${message}`);
    }
  }
}
