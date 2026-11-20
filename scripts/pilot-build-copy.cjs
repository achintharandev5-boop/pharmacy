// Creates isolated build inputs without .env files or active development output.
// Dependencies are reused read-only via junctions. Never run installation in these copies.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const label = process.argv[2];
if (!/^[a-z0-9-]+$/.test(label || '')) throw new Error('A unique lowercase build label is required');
const destination = path.join(root, '.turbo', 'pilot-remediation-20261102', 'builds', label);
if (fs.existsSync(destination)) throw new Error('Build copy already exists; use a new label');
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.turbo', 'coverage', 'dist', 'build'].includes(entry.name)
        || entry.name.startsWith('.env') || entry.name.endsWith('.tsbuildinfo')) continue;
    const source = path.join(from, entry.name), target = path.join(to, entry.name);
    if (entry.isDirectory()) copy(source, target);
    else if (entry.isFile()) fs.copyFileSync(source, target);
  }
}
for (const app of ['api', 'web']) {
  const source = path.join(root, 'apps', app), target = path.join(destination, app);
  copy(source, target);
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'junction');
}
console.log(destination);
