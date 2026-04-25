import { runCli } from './commands';

runCli(process.argv.slice(2))
  .then((output) => {
    process.stdout.write(`${output}\n`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
