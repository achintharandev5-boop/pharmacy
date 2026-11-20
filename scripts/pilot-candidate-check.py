"""Checks the isolated patched-Next dependency candidate; no deployment or live data."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.turbo/pilot-remediation-20261102'
CANDIDATE = OUT / 'dependency-candidate'
ENV = dict(os.environ, PATH=str(OUT / 'runtime/node-v22.23.4-win-x64') + os.pathsep + os.environ['PATH'],
           API_URL='https://api-build.example.invalid', PILOT_API_URL='https://api-build.example.invalid',
           NEXT_TELEMETRY_DISABLED='1', NEXT_PUBLIC_UI_TEST_MODE='false', SMS_ENABLED='false',
           NODE_OPTIONS='--max-old-space-size=3072')
CHECKS = {
    'build': ['exec', 'next', 'build', '--webpack'],
    'types': ['exec', 'tsc', '--noEmit', '--incremental', 'false'],
    'lint': ['exec', 'eslint', '.', '--format', 'json'],
    'tests': ['exec', 'vitest', 'run', '--pool=threads', '--maxWorkers=1', '--testTimeout=30000'],
    'audit': ['audit', '--json'],
    'api-unit': ['exec', 'jest', '--runInBand'],
    'api-e2e': ['exec', 'jest', '--config', './test/jest-e2e.json', '--runInBand'],
    'api-db': ['exec', 'jest', '--config', './test/jest-db.json', '--runInBand'],
    'api-build': ['exec', 'nest', 'build'],
    'api-types': ['exec', 'tsc', '--noEmit', '--incremental', 'false'],
    'api-lint': ['exec', 'eslint', '{src,apps,libs,test}/**/*.ts', '--format', 'json'],
}

for name in sys.argv[1:]:
    if name not in CHECKS:
        raise SystemExit('Choose: ' + ', '.join(CHECKS))
    args = ['pnpm.cmd', *CHECKS[name]]
    started = time.monotonic()
    env = dict(ENV)
    if name == 'api-db':
        env.update(DB_TEST_URL='postgres://pilot_local@127.0.0.1:55473/postgres',
                   DB_TEST_FRESH_ONLY='true', DB_TEST_RUN_ID='c' + str(int(time.time())))
    with (OUT / ('candidate-' + name + '.log')).open('wb') as log:
        working = CANDIDATE if name == 'audit' else CANDIDATE / ('apps/api' if name.startswith('api-') else 'apps/web')
        result = subprocess.run(args, cwd=working, env=env, stdout=log, stderr=subprocess.STDOUT)
    metadata = dict(check=name, command=args, exit_code=result.returncode,
                    node='22.23.4', seconds=round(time.monotonic()-started, 2),
                    lock_sha256=hashlib.sha256((CANDIDATE/'pnpm-lock.yaml').read_bytes()).hexdigest())
    (OUT / ('candidate-' + name + '-result.json')).write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata), flush=True)
