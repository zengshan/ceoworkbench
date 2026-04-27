import { createCliRuntime, runCli } from './commands';

const runtime = createCliRuntime();

runCli(process.argv.slice(2), runtime)
  .then((output) => {
    process.stdout.write(`${output}\n`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await runtime.close?.();
  });
