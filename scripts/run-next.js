const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const nextBin = require.resolve('next/dist/bin/next');
const command = process.argv[2] || 'dev';
const args = process.argv.slice(3);

const port = process.env.PORT || process.env.LOCAL_PORT || '8881';
const hostname = process.env.HOSTNAME || '0.0.0.0';

const child = spawn(
  process.execPath,
  [nextBin, command, '-p', port, '-H', hostname, ...args],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
