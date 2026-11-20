"""Checks the isolated landing-page copy; no installation, database access or deployment."""
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.turbo/landing-20261102-215321'
WEB = OUT / 'web'
NODE = ROOT / '.turbo/pilot-remediation-20261102/runtime/node-v22.23.4-win-x64/node.exe'
PNPM = pathlib.Path(os.environ['APPDATA']) / 'npm/node_modules/pnpm/bin/pnpm.cjs'
DEPS = ROOT / '.turbo/staging-preparation-20261102-164621/candidate/apps/web/node_modules'
CLIS = {'next': 'next/dist/bin/next', 'tsc': 'typescript/bin/tsc',
        'eslint': 'eslint/bin/eslint.js', 'vitest': 'vitest/vitest.mjs'}
CHECKS = {
    'typegen': ['exec', 'next', 'typegen'],
    'types': ['exec', 'tsc', '--noEmit', '--incremental', 'false'],
    'lint': ['exec', 'eslint', '.', '--format', 'json'],
    'tests': ['exec', 'vitest', 'run', '--maxWorkers=1', '--testTimeout=30000',
              'components/marketing/LandingPage.test.tsx', 'proxy.test.ts', 'uiTestProxy.test.ts',
              'lib/server/stagingConfiguration.test.ts', 'app/actions/sms.test.ts',
              'components/StagingPrintProtection.test.tsx'],
    'build': ['exec', 'next', 'build', '--webpack'],
}
ENV = dict(os.environ, PATH=str(NODE.parent) + os.pathsep + os.environ['PATH'],
           NEXT_TELEMETRY_DISABLED='1', SMS_ENABLED='false')


def main():
    failed = False
    for name in sys.argv[1:]:
        if name not in CHECKS:
            raise SystemExit('Choose: ' + ', '.join(CHECKS))
        env = dict(ENV)
        if name in ('build', 'typegen'):
            env.update(DEPLOYMENT_PROFILE='synthetic-staging', NEXT_PUBLIC_DEPLOYMENT_PROFILE='synthetic-staging',
                       STAGING_DATA_POLICY='synthetic-only', STAGING_GATEWAY_TOKEN='a' * 64,
                       NEXT_PUBLIC_UI_TEST_MODE='false', API_URL='https://staging-api.example.invalid',
                       PILOT_API_URL='https://staging-api.example.invalid')
            env.pop('SUPABASE_SERVICE_ROLE_KEY', None)
        started = time.monotonic()
        with (OUT / (name + '.log')).open('wb') as log:
            # pnpm Windows shims have relative paths tied to their original workspace.
            # Invoke the same installed CLIs directly when reusing dependencies read-only.
            result = subprocess.run([str(NODE), str(DEPS / CLIS[CHECKS[name][1]]), *CHECKS[name][2:]], cwd=WEB, env=env,
                                    stdout=log, stderr=subprocess.STDOUT)
        data = dict(check=name, command=['pnpm', *CHECKS[name]], exit_code=result.returncode,
                    seconds=round(time.monotonic()-started, 2), node='22.23.4')
        (OUT / (name + '-result.json')).write_text(json.dumps(data, indent=2))
        print(json.dumps(data), flush=True)
        failed = failed or result.returncode != 0
    return int(failed)


if __name__ == '__main__':
    sys.exit(main())
