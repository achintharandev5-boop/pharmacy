"""Isolated staging dependency/build checks. No external infrastructure or database writes.

prepare copies source without env/dependencies/output. Other commands operate only
on that copy. Never installs into the active development tree or deploys anything.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.turbo/staging-preparation-20261102-164621'
CANDIDATE = OUT / 'candidate'
NODE = ROOT / '.turbo/pilot-remediation-20261102/runtime/node-v22.23.4-win-x64/node.exe'
PNPM = pathlib.Path(os.environ['APPDATA']) / 'npm/node_modules/pnpm/bin/pnpm.cjs'
ENV = dict(os.environ, PATH=str(NODE.parent) + os.pathsep + os.environ['PATH'],
           SMS_ENABLED='false', NEXT_TELEMETRY_DISABLED='1')
COMMANDS = {
    'resolve': ('.', ['install', '--lockfile-only', '--ignore-scripts']),
    'install': ('.', ['install', '--frozen-lockfile', '--ignore-scripts']),
    'audit': ('.', ['audit', '--json']),
    'audit-prod': ('.', ['audit', '--prod', '--json']),
    'api-types': ('apps/api', ['exec', 'tsc', '--noEmit', '--incremental', 'false']),
    'web-types': ('apps/web', ['exec', 'tsc', '--noEmit', '--incremental', 'false']),
    'api-unit': ('apps/api', ['exec', 'jest', '--runInBand']),
    'api-e2e': ('apps/api', ['exec', 'jest', '--config', './test/jest-e2e.json', '--runInBand']),
    'api-db': ('apps/api', ['exec', 'jest', '--config', './test/jest-db.json', '--runInBand']),
    'web-unit': ('apps/web', ['exec', 'vitest', 'run', '--maxWorkers=1', '--testTimeout=30000']),
    'api-lint': ('apps/api', ['exec', 'eslint', '{src,apps,libs,test}/**/*.ts', '--format', 'json']),
    'web-lint': ('apps/web', ['exec', 'eslint', '.', '--format', 'json']),
    'api-build': ('apps/api', ['exec', 'nest', 'build']),
    'web-build': ('apps/web', ['exec', 'next', 'build', '--webpack']),
    'web-build-guarded': ('apps/web', ['exec', 'node', '../../deploy/staging/build-web.cjs']),
}


def prepare(refresh=False):
    if CANDIDATE.exists() and not refresh:
        raise SystemExit('Candidate already exists; refusing to overwrite it')
    CANDIDATE.mkdir(parents=True, exist_ok=refresh)
    for name in ['package.json', 'pnpm-workspace.yaml', '.node-version']:
        shutil.copy2(ROOT / name, CANDIDATE / name)
    if not refresh: shutil.copy2(ROOT / 'pnpm-lock.yaml', CANDIDATE / 'pnpm-lock.yaml')
    for name in ['apps', 'packages', 'deploy']:
        shutil.copytree(ROOT / name, CANDIDATE / name, dirs_exist_ok=refresh, ignore=shutil.ignore_patterns(
            'node_modules', '.next', 'dist', 'coverage', '.turbo', '.env*', '*.tsbuildinfo'))
    print('Created isolated source candidate: ' + str(CANDIDATE))


def main():
    names = sys.argv[1:]
    if names in (['prepare'], ['refresh']):
        prepare(refresh=names == ['refresh'])
        return 0
    if not names or any(name not in COMMANDS for name in names):
        raise SystemExit('Choose prepare or ' + ', '.join(COMMANDS))
    version = subprocess.check_output([str(NODE), '--version'], text=True).strip()
    failed = False
    for name in names:
        app, args = COMMANDS[name]
        env = dict(ENV)
        if name == 'api-db':
            # The audited local cluster only; never honor a caller's DB_TEST_URL.
            pg = pathlib.Path('C:/Program Files/PostgreSQL/18/bin/psql.exe')
            pg_env = {key: value for key, value in env.items() if not key.startswith('PG')}
            pg_env.update(PGHOST='127.0.0.1', PGPORT='55473', PGUSER='pilot_local', PGCONNECT_TIMEOUT='5')
            actual = subprocess.check_output([str(pg), '-XAt', '-d', 'postgres', '-c', 'SHOW data_directory'],
                                             env=pg_env, text=True).strip()
            expected = str(ROOT / '.turbo/pilot-remediation-20261102/pgdata')
            if actual.replace('\\', '/').lower() != expected.replace('\\', '/').lower():
                raise SystemExit('Refusing database tests outside the audited local cluster')
            env.update(DB_TEST_URL='postgres://pilot_local@127.0.0.1:55473/postgres',
                       DB_TEST_FRESH_ONLY='true', DB_TEST_RUN_ID='s' + str(int(time.time())))
        if name in ('web-build', 'web-build-guarded'):
            # Synthetic configuration only. The dummy gateway is a non-secret fixture,
            # supplied only to this isolated build, never a provider/deployment credential.
            env.update(DEPLOYMENT_PROFILE='synthetic-staging',
                       NEXT_PUBLIC_DEPLOYMENT_PROFILE='synthetic-staging',
                       STAGING_DATA_POLICY='synthetic-only', STAGING_GATEWAY_TOKEN='a' * 64,
                       NEXT_PUBLIC_UI_TEST_MODE='false',
                       API_URL='https://staging-api.example.invalid',
                       PILOT_API_URL='https://staging-api.example.invalid')
            for key in list(env):
                if key.startswith('NEXT_PUBLIC_') and key not in {
                    'NEXT_PUBLIC_DEPLOYMENT_PROFILE', 'NEXT_PUBLIC_UI_TEST_MODE'}:
                    del env[key]
            env.pop('SUPABASE_SERVICE_ROLE_KEY', None)
        started = time.monotonic()
        for suffix in ['.log', '-result.json']:
            previous = OUT / (name + suffix)
            if previous.exists():
                archive = OUT / 'attempts'
                archive.mkdir(exist_ok=True)
                shutil.copy2(previous, archive / (str(time.time_ns()) + '-' + previous.name))
        with (OUT / (name + '.log')).open('wb') as log:
            result = subprocess.run([str(NODE), str(PNPM), *args], cwd=CANDIDATE / app,
                                    env=env, stdout=log, stderr=subprocess.STDOUT)
        metadata = dict(check=name, command=['pnpm', *args], cwd=app, node=version,
                        exit_code=result.returncode, seconds=round(time.monotonic()-started, 2))
        (OUT / (name + '-result.json')).write_text(json.dumps(metadata, indent=2))
        print(json.dumps(metadata), flush=True)
        failed = failed or result.returncode != 0
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
