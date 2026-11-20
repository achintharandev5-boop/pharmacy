"""Verify migrations/SQL concurrency and restore using ONLY this audit's new cluster.

No configurable connection URL, no dropping databases, no remote operations.
Requires the cluster initialized at .turbo/pilot-remediation-20261102/pgdata,
running on loopback port 55473 as pilot_local. Every run creates fresh databases.
"""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / '.turbo/pilot-remediation-20261102'
PGDATA = EVIDENCE / 'pgdata'
PG = pathlib.Path('C:/Program Files/PostgreSQL/18/bin')
HERE = ROOT / 'apps/api/supabase/tests'
RUN = datetime.datetime.now().strftime('%Y%m%d%H%M%S')
DB = 'pilot_sql_' + RUN
RESTORED = 'pilot_restore_' + RUN
ENV = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
ENV.update(PGHOST='127.0.0.1', PGPORT='55473', PGUSER='pilot_local',
           PGCLIENTENCODING='UTF8', PGCONNECT_TIMEOUT='5', TEST_DB=DB,
           PSQL=str(PG / 'psql.exe'), TMPDIR=str(EVIDENCE).replace('C:', '/c'))


def command(args, capture=False):
    return subprocess.run([str(a) for a in args], env=ENV, cwd=ROOT, check=True,
                          stdout=subprocess.PIPE if capture else None,
                          encoding='utf-8' if capture else None).stdout


def sql(database, query):
    return command([PG / 'psql.exe', '-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1',
                    '-d', database, '-c', query], capture=True).strip()


def file(database, path):
    command([PG / 'psql.exe', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database, '-f', path])


def signatures(database):
    result = {}
    for schema in ['public', 'auth']:
        for table in sql(database, f"SELECT tablename FROM pg_tables WHERE schemaname='{schema}' ORDER BY tablename").splitlines():
            if not re.fullmatch('[a-z_]+', table):
                raise RuntimeError('Unexpected table identifier')
            result[schema + '.' + table] = sql(database,
                f"SELECT count(*) || ':' || md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) FROM {schema}.{table} t")
    for name, query in {
        'constraints': "SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid, true), convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2",
        'policies': "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies ORDER BY 1,2,3",
        'rls': "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY 1",
        'functions': "SELECT proname,pg_get_function_identity_arguments(oid),prosrc,prosecdef,proacl FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY 1,2",
        'grants': "SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' ORDER BY 1,2,3",
        'sequences': "SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY 1",
    }.items():
        result[name] = hashlib.sha256(sql(database, query).encode()).hexdigest()
    return result


def main():
    expected = str(PGDATA.resolve()).replace('\\', '/').lower()
    actual = sql('postgres', 'SHOW data_directory').replace('\\', '/').lower()
    if actual != expected or not (PGDATA / 'PG_VERSION').exists():
        raise RuntimeError('Refusing to use a cluster outside the audit recovery directory')
    command([PG / 'createdb.exe', DB])  # Never overwrites an existing database.
    # Use the same minimal provider stand-in as the real database integration harness.
    harness = (ROOT / 'apps/api/test/db/harness.ts').read_text(encoding='utf-8')
    stub = re.search(r'const SUPABASE_STUB = `([\s\S]*?)`;', harness).group(1)
    sql(DB, stub)
    migration_evidence = []
    for migration in sorted((ROOT / 'apps/api/supabase/migrations').glob('*.sql')):
        file(DB, migration)
        migration_evidence.append({'file': migration.name, 'sha256': hashlib.sha256(migration.read_bytes()).hexdigest()})
    # Reapply the established hardening series in order; never leave older functions last.
    for migration in sorted((ROOT / 'apps/api/supabase/migrations').glob('20261010*.sql')):
        file(DB, migration)
    file(DB, HERE / '10_migration_tests.sql')
    command(['C:/Program Files/Git/bin/bash.exe', HERE / '20_concurrency_test.sh'])
    file(DB, HERE / '30_returns_dispensing_tests.sql')
    command(['C:/Program Files/Git/bin/bash.exe', HERE / '40_dispensing_concurrency_test.sh'])
    file(DB, HERE / '60_reasons_catalogue_tests.sql')
    before = signatures(DB)
    dump = EVIDENCE / (DB + '.dump')
    started = time.monotonic()
    command([PG / 'pg_dump.exe', '-Fc', '-d', DB, '-f', dump])
    command([PG / 'pg_restore.exe', '--list', dump], capture=True)
    command([PG / 'createdb.exe', RESTORED])
    command([PG / 'pg_restore.exe', '--exit-on-error', '-d', RESTORED, dump])
    after = signatures(RESTORED)
    if before != after:
        raise RuntimeError('Restored rows/schema/security/sequences differ')
    report = dict(source=DB, restored=RESTORED, migrations=migration_evidence,
                  sql_checks='PASS', concurrency='PASS', restore='PASS',
                  restore_seconds=round(time.monotonic()-started, 2), signatures=after,
                  scope='Disposable local PostgreSQL 18; synthetic only; provider Auth is a stand-in',
                  staging_verified=False, physical_stock_reconciled=False)
    (EVIDENCE / 'local-db-restore-result.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({k:v for k,v in report.items() if k != 'signatures'}, indent=2))


if __name__ == '__main__':
    main()
