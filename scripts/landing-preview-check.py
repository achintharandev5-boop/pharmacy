"""Starts only the isolated, built local preview, runs browser checks, then stops it."""
import json
import os
import pathlib
import socket
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / '.turbo/landing-20261102-215321'
NODE = ROOT / '.turbo/pilot-remediation-20261102/runtime/node-v22.23.4-win-x64/node.exe'
CLI = ROOT / '.turbo/staging-preparation-20261102-164621/candidate/apps/web/node_modules/next/dist/bin/next'
env = dict(os.environ, NODE_ENV='production', NEXT_TELEMETRY_DISABLED='1', SMS_ENABLED='false',
           DEPLOYMENT_PROFILE='synthetic-staging', NEXT_PUBLIC_DEPLOYMENT_PROFILE='synthetic-staging',
           STAGING_DATA_POLICY='synthetic-only', STAGING_GATEWAY_TOKEN='a' * 64,
           NEXT_PUBLIC_UI_TEST_MODE='false', API_URL='https://staging-api.example.invalid',
           PILOT_API_URL='https://staging-api.example.invalid', LANDING_PREVIEW_URL='http://127.0.0.1:3107')
env.pop('SUPABASE_SERVICE_ROLE_KEY', None)
with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1', 3107)) == 0:
        raise SystemExit('Port 3107 is in use; refusing to replace an existing server')
with (OUT / 'preview-server.log').open('wb') as log:
    server = subprocess.Popen([str(NODE), str(CLI), 'start', '-p', '3107', '-H', '127.0.0.1'],
                              cwd=OUT / 'web', env=env, stdout=log, stderr=subprocess.STDOUT,
                              creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for attempt in range(150):
            if server.poll() is not None:
                raise RuntimeError('Preview server exited; inspect its redacted local log')
            try:
                with socket.create_connection(('127.0.0.1', 3107), timeout=.2):
                    break
            except OSError:
                time.sleep(.2)
        else:
            raise RuntimeError('Preview did not start')
        with (OUT / 'browser.log').open('wb') as browser_log:
            result = subprocess.run([str(NODE), str(ROOT / 'scripts/landing-browser.cjs')],
                                    cwd=ROOT, env=env, stdout=browser_log, stderr=subprocess.STDOUT)
        (OUT / 'browser-result.json').write_text(json.dumps({'exit_code': result.returncode}, indent=2))
        print('Browser verification exit:', result.returncode)
    finally:
        server.terminate()
        server.wait(timeout=20)
raise SystemExit(result.returncode)
