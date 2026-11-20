# Pharmacy landing page — local implementation

## Route and preservation

The landing page is at **`/welcome`**. `/` already hosts the staff workspace and is
the destination of successful login navigation. It was retained unchanged, along
with login, dashboard, prescriptions, inventory, patients, POS and admin routes.
The existing proxy still redirects anonymous `/welcome` requests to `/login`.
Provider-level private staging access and the server-only API gateway remain
unchanged. This is not a new public access exception.

No backend endpoint, database schema, clinical text, stock algorithm, authentication
implementation, environment template, dependency manifest or lockfile was modified.
No registration, checkout, payments, invoicing, invented contact address or legal
policy was added. No deployment was performed. Production remains **NO-GO**; neither
the production assessment nor private-staging verdict is changed by this work.

The current dirty tree was preserved before edits in the private ignored directory
`.turbo/landing-20261102-215321/`, including a source ZIP, SHA-256 manifest and Git
status. Existing changes were not committed, reset, cleaned or discarded.

## Component structure

- `apps/web/app/welcome/page.tsx`: server-rendered route, title/description/Open Graph
  metadata, explicit noindex/nofollow/noarchive and local font preload.
- `components/marketing/LandingPage.tsx`: hero, six capability cards, three alternating
  workflow showcases, process, security, pilot availability, final CTA and footer.
- `LandingNav.tsx`: sticky desktop navigation and accessible mobile disclosure;
  section anchors, Escape handling and focus return. All staff CTAs use `/login`.
- `ProductPreview.tsx`: responsive editorial UI illustrations based on the actual
  application module names. Every preview identifies synthetic/illustrative content.
  No patient data, live metrics, API requests, actual clinical instructions or
  imports of operational dashboard components are involved.
- `Reveal.tsx`: small progressive-enhancement IntersectionObserver animation.
  Content remains visible without JavaScript; reduced-motion users skip animation.
- `landing.module.css`: scoped emerald/white design, responsive layout and typography;
  existing operational app themes are unaffected. The landing page stays light
  even if the staff application preference is dark.
- `public/fonts/InterVariable.woff2` and `Inter-LICENSE.txt`: self-hosted Inter font
  and its required license, obtained from the [official Inter repository](https://github.com/rsms/inter).
  No new package was installed. Existing global Sinhala font imports were retained.

Contact and privacy links are intentionally absent because no approved address,
contact route or policy page was found. The product illustrations are components,
not screenshots of operational patient or inventory data. All cards and previews
avoid fabricated operational statistics. POS and pilot limitations are explicit.

## Verification scope

Checks use a separate source copy under `.turbo/landing-20261102-215321/web` and the
existing patched Next 16.4.3 / Vitest 4.1 dependencies read-only. They do not install
packages, replace active development node_modules or overwrite a development `.next`.
The isolated build uses synthetic staging flags and a reserved invalid API origin,
with no `.env` files or Supabase service-role credential copied into it.

Commands:

```text
python scripts/landing-check.py typegen types lint tests build
python scripts/landing-preview-check.py
```

The check runner invokes the installed Next/TypeScript/ESLint/Vitest CLIs directly
under Node 22.23.4 because reused pnpm Windows shims contain workspace-relative paths.
The logged pnpm command equivalents describe the same checks. Initial shim resolution
failures and sandbox EPERM worker failures are runner failures, not passing checks.
The required worker operations were retried outside the sandbox with permission.

`LandingPage.test.tsx` tests semantic structure, actual section/link destinations,
all staff CTAs, pilot/unfinished-feature limitations, synthetic previews, metadata,
mobile menu state and Escape focus. `proxy.test.ts` adds one regression proving the
landing route remains protected; the proxy implementation itself is unchanged.
Existing staging, SMS, print-protection and proxy test files are included in the
targeted run. Backend/full clinical suites were not rerun for this isolated UI work.

Browser checks use only loopback, a synthetic navigation cookie, and the static
landing route. That cookie is not a valid backend session. Anonymous application
redirect checks never call a protected data API. External browser requests are
blocked during visual testing. Axe checks use the existing local development tool,
not a new application dependency. Browser samples do not certify accessibility or
prove actual provider access configuration.

## Verification results

All commands ran against an isolated copy of `apps/web` with Node 22.23.4 and the
already installed patched dependencies. Build configuration used synthetic-only
staging flags and the reserved invalid API host. No application credentials were
provided.

- `next typegen`: PASS.
- `tsc --noEmit --incremental false`: PASS.
- `eslint . --format json`: PASS, zero findings.
- Targeted Vitest command listed above: PASS, 47 tests passed, 0 failed across 6
  files. It includes the landing component, proxy guard regression, existing UI
  proxy, staging configuration, SMS action and print protection tests.
- `next build --webpack`: PASS; `/welcome` is statically prerendered. The final
  build took 583 seconds on this workstation.
- Headless Edge responsive checks: PASS at 375, 430, 768, 1024, 1440 and 1920 px;
  one H1, local Inter font family, no horizontal overflow, `noindex` robots metadata
  and reduced-motion preference recognized at each width.
- Anonymous navigation checks: `/welcome`, `/admin`, `/label`, `/pos`,
  `/admin/inventory` and `/admin/patients` each redirected to `/login`; `/login`
  returned 200. The mobile menu, Escape-to-close/focus return, keyboard use and
  `#features` anchor passed.
- axe-core WCAG 2.0 A/AA and 2.1 AA scans: zero violations at 375 and 1440 px.
- Browser runtime errors: zero. Existing global stylesheet attempted Google Fonts
  requests; the browser audit blocked those external requests. The landing page's
  own Inter font is self-hosted and used in the page.

The checks did not authenticate a real staff account, call the API, exercise
patient/inventory workflows, establish provider-level gateway protection, or test
a hosted environment. No deployed URL exists. Six full-page local screenshots and
the machine-readable results are in `docs/landing-preview/`.

## Preview

In an approved synthetic local/staging environment, sign in through the existing
staff login, then open `/welcome` on that same origin. It deliberately remains behind
the current access controls. The verification helper starts an isolated production
preview on loopback port 3107, runs its checks and stops the server afterward.
No persistent preview or hosted URL is created by that helper.

Screenshots and machine-readable browser results are written under
`docs/landing-preview/`. The synthetic-staging warning remains visible in those
samples. Readiness and physical clinical printer approvals are outside this task.
