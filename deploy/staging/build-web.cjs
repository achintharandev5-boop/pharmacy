const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
try {
  require('./require-profile.cjs')(process.env, true);
  const web = path.resolve(__dirname, '../../apps/web');
  const next = createRequire(path.join(web, 'package.json')).resolve('next/dist/bin/next');
  const result = spawnSync(process.execPath, [next, 'build', '--webpack'], { cwd: web, env: process.env, stdio: 'inherit' });
  process.exitCode = result.status === null ? 1 : result.status;
} catch {
  console.error('Staging web build refused. Check staging profile and dependency installation.');
  process.exitCode = 1;
}
