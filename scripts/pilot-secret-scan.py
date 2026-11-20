"""Offline, redacted scan of Git history and current source; never prints matching values.

This is a heuristic, not proof of credential revocation. Review findings privately.
Ignored environment files are inspected for risky public variable names, not archived.
"""
import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def findings(data):
    text = data.decode("utf-8", errors="replace")
    matches = []
    patterns = {
        "private-key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        "supabase-secret": r"sb_secret_[A-Za-z0-9_-]{20,}",
        "public-privileged-variable": r"NEXT_PUBLIC_[A-Z_]*(?:SERVICE_ROLE|SECRET|PASSWORD|API_TOKEN)[A-Z_]*",
        "literal-password-review": r"(?i)(?:password|passwd)\s*[:=]\s*['\"][^'\"\r\n]{8,}['\"]",
    }
    for kind, pattern in patterns.items():
        for match in re.finditer(pattern, text):
            matches.append((kind, text.count("\n", 0, match.start()) + 1,
                            hashlib.sha256(match.group().encode()).hexdigest()[:12]))
    for match in re.finditer(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", text):
        try:
            payload = match.group().split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
            if claims.get("role") == "service_role":
                matches.append(("service-role-jwt", text.count("\n", 0, match.start()) + 1,
                                hashlib.sha256(match.group().encode()).hexdigest()[:12]))
        except (ValueError, TypeError):
            pass
    return matches


def main():
    result = []
    files = set(git("ls-files", "-co", "--exclude-standard", "-z").decode().split("\0"))
    # Environment values are never emitted. Include local files omitted by Git.
    files.update(str(p.relative_to(ROOT)).replace("\\", "/")
                 for folder in [ROOT, ROOT / "apps/api", ROOT / "apps/web"]
                 for p in folder.glob(".env*"))
    for name in sorted(files):
        path = ROOT / name
        if not name or not path.is_file() or path.stat().st_size > 5_000_000:
            continue
        for kind, line, fingerprint in findings(path.read_bytes()):
            result.append(dict(source="worktree", path=name, line=line, kind=kind, fingerprint=fingerprint))
    # Scan each reachable historical blob once; no checkout or history rewrite.
    for entry in git("rev-list", "--objects", "--all").decode().splitlines():
        oid, _, name = entry.partition(" ")
        if not name or git("cat-file", "-t", oid).strip() != b"blob":
            continue
        if int(git("cat-file", "-s", oid)) > 5_000_000:
            continue
        for kind, line, fingerprint in findings(git("cat-file", "blob", oid)):
            result.append(dict(source="history", blob=oid, path=name, line=line, kind=kind, fingerprint=fingerprint))
    for item in result:
        # Exact reviewed synthetic fixtures, never a blanket test-directory exclusion.
        fixture_path = item['path']
        # pnpm may retain an identical source copy in its project cache. Scan it,
        # but apply the same exact path/fingerprint review to these copied fixtures.
        if fixture_path.startswith('.pnpm-store/v10/projects/'):
            fixture_path = fixture_path.split('/', 4)[-1]
        fixture = (fixture_path, item['fingerprint']) in {
            ('apps/api/test/db/harness.ts', '628252a09607'),
            ('apps/web/lib/uiTestMode.test.ts', '046a4005b51a'),
            ('apps/api/src/auth/auth.controller.spec.ts', 'd489077db5d5'),
        }
        local_env = item['source'] == 'worktree' and pathlib.PurePosixPath(item['path']).name == '.env'
        item['classification'] = 'synthetic-test-fixture' if fixture else 'local-server-secret' if local_env else 'review-required'
    actionable = sum(item['classification'] == 'review-required' for item in result)
    print(json.dumps({"scope": "current source, local env files, reachable Git blobs <=5MB",
                      "findings": result, "finding_count": len(result),
                      "review_required_count": actionable,
                      "revocation_verified": False}, indent=2))
    return 1 if actionable else 0


if __name__ == "__main__":
    sys.exit(main())
