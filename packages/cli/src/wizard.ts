import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Artifact } from '../../core/src';
import type { CliRuntime } from './commands';
import { runCli } from './commands';

const WIZARD_SCHEMA_VERSION = 1;

export type WizardMode = 'bootstrap' | 'ceo_instruction' | 'resume';

export type WizardOptions = {
  sessionRoot: string;
  prompt: (question: string) => Promise<string>;
  idGenerator?: () => string;
  runCommand?: (args: string[]) => Promise<string>;
  onProgress?: (line: string) => void;
  verbose?: boolean;
  mode?: WizardMode;
  stopAfterCheckpoint?: boolean;
  schemaVersionOverride?: number;
};

type WizardStep =
  | {
      kind: 'bootstrap';
      params_collected: {
        companyName: string;
        goal: string;
      };
    }
  | {
      kind: 'ceo_instruction';
      params_collected: {
        companyName?: string;
        goal?: string;
        message?: string;
      };
    };

type WizardSession = {
  schema_version: number;
  session_id: string;
  next_step: WizardStep;
  executed: WizardExecutedAction[];
};

type WizardExecutedAction =
  | {
      kind: 'company.init';
      companyName: string;
      goal: string;
      args: string[];
    }
  | {
      kind: 'ceo.instruction';
      message: string;
      args: string[];
      messageFile?: string;
    }
  | {
      kind: 'work';
      args: string[];
      output: string;
    };

export async function runWizard(runtime: CliRuntime, options: WizardOptions): Promise<string> {
  const mode = options.mode ?? await inferMode(runtime);

  await mkdir(options.sessionRoot, { recursive: true });

  if (mode === 'resume') {
    return resumeWizard(runtime, options);
  }

  const sessionId = options.idGenerator?.() ?? `session-${Date.now()}`;

  if (mode === 'ceo_instruction') {
    const message = await options.prompt('What should the CEO tell the manager? ');
    const session: WizardSession = {
      schema_version: options.schemaVersionOverride ?? WIZARD_SCHEMA_VERSION,
      session_id: sessionId,
      next_step: {
        kind: 'ceo_instruction',
        params_collected: { message },
      },
      executed: [],
    };
    await saveSession(options.sessionRoot, session);

    if (options.stopAfterCheckpoint) {
      return `Saved wizard session ${sessionId}.`;
    }

    return executeSession(runtime, options, session);
  }

  const companyName = await options.prompt('Company name: ');
  const goal = await options.prompt('Company goal: ');
  const message = options.stopAfterCheckpoint
    ? undefined
    : await options.prompt('What should the CEO tell the manager? ');
  const session: WizardSession = {
    schema_version: options.schemaVersionOverride ?? WIZARD_SCHEMA_VERSION,
    session_id: sessionId,
    next_step: {
      kind: 'ceo_instruction',
      params_collected: { companyName, goal, message },
    },
    executed: [],
  };

  await saveSession(options.sessionRoot, session);

  if (options.stopAfterCheckpoint) {
    return `Saved wizard session ${sessionId}.`;
  }

  return executeSession(runtime, options, session);
}

async function resumeWizard(runtime: CliRuntime, options: WizardOptions) {
  const session = await loadFirstSession(options.sessionRoot);
  const choice = (await options.prompt(`Resume wizard session ${session.session_id}? continue/discard `)).trim().toLowerCase();

  if (choice === 'discard') {
    await rm(sessionPath(options.sessionRoot, session.session_id));
    return `Discarded wizard session ${session.session_id}.`;
  }

  if (choice !== 'continue') {
    throw new Error('Wizard resume choice must be continue or discard');
  }

  const output = await executeSession(runtime, options, session);
  return `Resumed wizard session ${session.session_id}.\n${output}`;
}

async function executeSession(runtime: CliRuntime, options: WizardOptions, session: WizardSession) {
  if (session.schema_version !== WIZARD_SCHEMA_VERSION) {
    throw new Error(`Unsupported wizard session schema_version ${session.schema_version}`);
  }

  const runCommand = options.runCommand ?? ((args: string[]) => runCli(args, runtime, { onProgress: options.onProgress }));
  const actions: WizardExecutedAction[] = [...session.executed];
  const params = session.next_step.params_collected;
  const beforeArtifactIds = new Set((await listCurrentArtifacts(runtime)).map((artifact) => artifact.id));

  if (params.companyName && params.goal && !await hasInitializedCompany(runtime, params.companyName, actions)) {
    const args = ['company', 'init', params.companyName, '--goal', params.goal];
    await runCommand(args);
    if (!actions.some((action) => action.kind === 'company.init')) {
      actions.push({
        kind: 'company.init',
        companyName: params.companyName,
        goal: params.goal,
        args,
      });
    }
  }

  if (session.next_step.kind === 'ceo_instruction') {
    const ceoParams = session.next_step.params_collected;

    if (ceoParams.message || options.mode === 'resume') {
      ceoParams.message ??= await options.prompt('What should the CEO tell the manager? ');

      if (!actions.some((action) => action.kind === 'ceo.instruction')) {
        const action = await buildCeoInstructionAction(options.sessionRoot, session.session_id, ceoParams.message);
        await runCommand(action.args);
        actions.push(action);
      }

      if (!actions.some((action) => action.kind === 'work')) {
        const args = ['work'];
        const output = await runCommand(args);
        actions.push({
          kind: 'work',
          args,
          output,
        });
      }
    }
  }

  session.executed = actions;
  await saveSession(options.sessionRoot, session);

  const artifacts = options.verbose
    ? (await listCurrentArtifacts(runtime)).filter((artifact) => !beforeArtifactIds.has(artifact.id))
    : [];

  return renderSummary(actions, artifacts);
}

async function hasInitializedCompany(runtime: CliRuntime, companyName: string, actions: WizardExecutedAction[]) {
  if (!actions.some((action) => action.kind === 'company.init')) {
    return false;
  }

  return (await runtime.storage.listCompanies()).some((company) => company.name === companyName);
}

async function buildCeoInstructionAction(sessionRoot: string, sessionId: string, message: string): Promise<WizardExecutedAction> {
  if (!needsMessageFile(message)) {
    return {
      kind: 'ceo.instruction',
      message,
      args: ['ceo', message],
    };
  }

  const messageFile = path.join(sessionRoot, `${sessionId}-msg.txt`);
  await writeFile(messageFile, message, 'utf8');

  return {
    kind: 'ceo.instruction',
    message,
    args: ['ceo', '--message-file', messageFile],
    messageFile,
  };
}

async function inferMode(runtime: CliRuntime): Promise<WizardMode> {
  const companies = await runtime.storage.listCompanies();
  const company = companies[0];

  if (!company) {
    return 'bootstrap';
  }

  const manager = (await runtime.storage.listAgents(company.id)).find((agent) => agent.role === 'manager');
  return manager ? 'ceo_instruction' : 'bootstrap';
}

async function loadFirstSession(sessionRoot: string): Promise<WizardSession> {
  await mkdir(sessionRoot, { recursive: true });
  const files = (await readdir(sessionRoot)).filter((file) => file.endsWith('.json')).sort();
  const firstFile = files[0];

  if (!firstFile) {
    throw new Error('No wizard sessions to resume.');
  }

  const content = await readFile(path.join(sessionRoot, firstFile), 'utf8');
  return JSON.parse(content) as WizardSession;
}

async function saveSession(sessionRoot: string, session: WizardSession) {
  await mkdir(sessionRoot, { recursive: true });
  await writeFile(sessionPath(sessionRoot, session.session_id), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

function sessionPath(sessionRoot: string, sessionId: string) {
  return path.join(sessionRoot, `${sessionId}.json`);
}

async function listCurrentArtifacts(runtime: CliRuntime) {
  const company = (await runtime.storage.listCompanies())[0];
  return company ? runtime.storage.listArtifacts(company.id) : [];
}

function renderSummary(actions: WizardExecutedAction[], artifacts: Artifact[] = []) {
  const lines = [
    'Wizard executed:',
    ...actions.map((action) => `  - ${renderAction(action)}`),
    '',
    'Equivalent commands:',
    ...actions.map((action) => `  npm run ceoworkbench -- ${action.args.map(shellQuote).join(' ')}`),
  ];

  if (artifacts.length > 0) {
    lines.push(
      '',
      'Artifacts produced:',
      ...artifacts.map((artifact) => `  - ${artifact.title} (${artifact.path}, status: ${artifact.status})`),
    );
  }

  return lines.join('\n');
}

function renderAction(action: WizardExecutedAction) {
  if (action.kind === 'company.init') {
    return `company.init name=${JSON.stringify(action.companyName)} goal=${JSON.stringify(action.goal)}`;
  }

  if (action.kind === 'work') {
    return `work result=${JSON.stringify(action.output)}`;
  }

  return action.messageFile
    ? `ceo.instruction message_file=${JSON.stringify(action.messageFile)}`
    : `ceo.instruction message=${JSON.stringify(action.message)}`;
}

function needsMessageFile(value: string) {
  return /[\n\r'"\\$`]/.test(value);
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}
