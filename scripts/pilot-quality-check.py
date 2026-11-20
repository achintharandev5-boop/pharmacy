"""Read-only local quality checks with bounded test workers and recorded exit codes.

Usage: python scripts/pilot-quality-check.py api-types web-types api-unit ...
Run outside the Windows sandbox when esbuild/local HTTP subprocesses need permission.
Never uses DB_TEST_URL from the shell: database checks bind this audit's fresh cluster.
"""
import json
import datetime
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.turbo/pilot-remediation-20261102'
RUNTIME = OUT / 'runtime/node-v22.23.4-win-x64'
ENV = dict(os.environ, PATH=str(RUNTIME) + os.pathsep + os.environ['PATH'],
           NEXT_TELEMETRY_DISABLED='1', SMS_ENABLED='false')
CHECKS = {
    'api-types': ('api', ['exec', 'tsc', '--noEmit', '--incremental', 'false']),
    'web-types': ('web', ['exec', 'tsc', '--noEmit', '--incremental', 'false']),
    'api-unit': ('api', ['exec', 'jest', '--runInBand']),
    'web-unit': ('web', ['exec', 'vitest', 'run', '--pool=threads', '--maxWorkers=1', '--testTimeout=30000']),
    'api-e2e': ('api', ['exec', 'jest', '--config', './test/jest-e2e.json', '--runInBand']),
    'api-lint': ('api', ['exec', 'eslint', '{src,apps,libs,test}/**/*.ts', '--format', 'json']),
    'web-lint': ('web', ['exec', 'eslint', '.', '--format', 'json']),
    'api-db': ('api', ['exec', 'jest', '--config', './test/jest-db.json', '--runInBand']),
}


def main():
    names = sys.argv[1:]
    if not names or any(name not in CHECKS for name in names):
        raise SystemExit('Choose checks from: ' + ', '.join(CHECKS))
    # Never overwrite earlier evidence or label a fallback system runtime as Node 22.
    runtime = RUNTIME / 'node.exe'
    version = subprocess.check_output([str(runtime), '--version'], text=True).strip()
    child_version = subprocess.check_output(
        ['pnpm.cmd', 'exec', 'node', '-p', 'process.version'],
        cwd=ROOT, env=ENV, text=True,
    ).strip()
    if child_version != version:
        raise SystemExit('Refusing checks: pnpm child runtime differs from the selected runtime')
    run_out = OUT / 'runs' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    run_out.mkdir(parents=True)
    print('Evidence: ' + str(run_out), flush=True)
    failed = False
    for name in names:
        app, args = CHECKS[name]
        env = dict(ENV)
        if name == 'api-db':
            # Fresh-only with unique DB names; no drops, no remote credentials.
            env.update(DB_TEST_URL='postgres://pilot_local@127.0.0.1:55473/postgres',
                       DB_TEST_FRESH_ONLY='true', DB_TEST_RUN_ID='p' + str(int(time.time())))
        started = time.monotonic()
        with (run_out / (name + '-final.log')).open('wb') as log:
            result = subprocess.run(['pnpm.cmd', *args], cwd=ROOT / 'apps' / app,
                                    env=env, stdout=log, stderr=subprocess.STDOUT)
        metadata = dict(check=name, command=['pnpm', *args], app=app,
                        node=version, exit_code=result.returncode,
                        seconds=round(time.monotonic()-started, 2))
        (run_out / (name + '-final-result.json')).write_text(json.dumps(metadata, indent=2))
        print(json.dumps(metadata), flush=True)
        failed = failed or result.returncode != 0
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
