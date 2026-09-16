import { spawn } from 'node:child_process';

/**
 * Runs the browser QA suites in order against a preview build.
 * Start the server first: `npm run build && npm run preview`.
 */
const SUITES = ['responsive.mjs', 'accessibility.mjs', 'flows.mjs', 'states.mjs'];

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [new URL(file, import.meta.url).pathname], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });

let failed = 0;
for (const suite of SUITES) {
  const code = await run(suite);
  if (code !== 0) failed += 1;
}

console.log(failed ? `\n${failed} of ${SUITES.length} QA suites failed.` : `\nAll ${SUITES.length} QA suites passed.`);
process.exit(failed ? 1 : 0);
