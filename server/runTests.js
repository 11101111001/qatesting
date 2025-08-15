import { spawn } from 'child_process';

export function runTestStream(testName, res) {
  const proc = spawn('npx', ['playwright', 'test', testName, '--reporter=list'], {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
  });

  proc.stdout.on('data', data => {
    res.write(`data: ${data.toString().replace(/\n/g, '\ndata: ')}\n\n`);
  });

  proc.stderr.on('data', data => {
    res.write(`data: ERROR: ${data.toString().replace(/\n/g, '\ndata: ')}\n\n`);
  });

  proc.on('close', code => {
    res.write(`data: Test run finished with code ${code}\n\n`);
    res.end();
  });
}
