# Staging dependency risk assessment

Fresh registry evidence reproduces the previous 11 critical and 23 high findings. The patched isolated candidate reports **0 critical, 0 high, 17 moderate, 3 low** across all dependencies; production-only audit reports **0 critical, 0 high, 3 moderate**. Audit exit 1 still indicates the residual findings; it is not a clean-all-severities result. Counts are advisory findings and can overlap one package. No exploit was executed.

## Changes and reachability

| Group | Exposure in this repository | Mitigation |
|---|---|---|
| Next.js | Server rendering/actions are deployed. Framework image endpoints are an HTTP surface even without a visible image widget. Windows-only RCE conditions do not match Linux hosting, but other cache/image/redirect conditions cannot be dismissed solely because access is private | Upgrade Next and eslint-config-next together from 16.3.2 to 16.4.3; provider access protection remains required |
| Express proxy-addr/body-parser/multer | API HTTP infrastructure. trust proxy is not enabled; no file-upload interceptor was found. Body parsing can precede application middleware, so the gateway alone is not complete mitigation | Patch proxy-addr 2.0.8, body-parser 2.4.0, multer 2.5.0 through narrowly pinned overrides |
| sharp | Native image processing used by Next image infrastructure; malformed-image conditions can matter at an optimizer endpoint | Fresh patched resolution removes both high findings |
| Vitest/Vite/tinypool | Development/test tooling, not service start commands. UI/dev/editor endpoints must never listen on a hosted deployment. Prior Vitest UI issue permits local file access/execution when UI server is exposed; Vite editor issues include Windows shell conditions | Vitest 4.1.0, Vite 8.2.4; test-project config migrated; never host dev or UI servers |
| handlebars/js-yaml/fast-uri/brace-expansion/source-map-js/zod | Build/CLI/lint/schema/glob dependency paths; exploit requires untrusted template/YAML/schema/glob/map/parser input. They are not automatically reachable as application HTTP handlers, but can execute during build/install | Pin patched versions, preserve lockfile, install with lifecycle scripts disabled, run regression/build checks |

Full affected baseline package/version/path records follow. Advisory links give exact exploit preconditions and vendor fixes. Runtime reachability statements above are source/configuration inferences, not penetration-test evidence.

## Baseline critical/high findings

| Package | Severity | Installed vulnerable versions | Patched threshold | Dependency path | Advisory |
|---|---|---|---|---|---|
| vitest | critical | 2.1.9 | >=3.2.6 | apps__web>vitest | [When Vitest UI server is listening, arbitrary file can be read and executed](https://github.com/advisories/GHSA-5xrq-8626-4rwp) |
| next | critical | 16.3.2 | >=16.3.3 | apps__web>next | [Next.js: Unauthenticated Remote Code Execution on windows-hosted servers](https://github.com/advisories/GHSA-p293-qw3h-jr36) |
| sharp | high | 0.35.3 | >=0.35.4 | apps__web>next>sharp | [sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) |
| js-yaml | high | 3.15.1 | >=3.15.2 | apps__api>jest>@jest/core>@jest/transform>babel-plugin-istanbul>@istanbuljs/load-nyc-config>js-yaml | [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| js-yaml | high | 4.3.1 | >=4.3.2 | apps__api>@eslint/eslintrc>js-yaml | [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-2883-xcg3-v3hh) |
| next | critical | 16.3.2 | >=16.3.3 | apps__web>next | [Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) |
| multer | high | 2.2.0 | >=2.3.0 | apps__api>@nestjs/platform-express>multer | [multer vulnerable to Denial of Service via crafted multipart field names](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm) |
| multer | high | 2.2.0 | >=2.3.0 | apps__api>@nestjs/platform-express>multer | [multer vulnerable to Denial of Service via file descriptor leak on aborted uploads](https://github.com/advisories/GHSA-qfvm-cv95-jqjf) |
| multer | high | 2.2.0 | >=2.3.0 | apps__api>@nestjs/platform-express>multer | [multer vulnerable to Denial of Service via oversized array index in field names](https://github.com/advisories/GHSA-535w-7cp7-47q4) |
| fast-uri | high | 3.1.6 | >=3.1.7 | apps__api>@nestjs/cli>@angular-devkit/core>ajv>fast-uri | [fast-uri vulnerable to authority injection via an unvalidated port in serialize](https://github.com/advisories/GHSA-qw65-cvwx-89v3) |
| fast-uri | high | 3.1.6 | >=3.1.7 | apps__api>@nestjs/cli>@angular-devkit/core>ajv>fast-uri | [fast-uri vulnerable to host confusion via an unclosed bracket in the URI authority](https://github.com/advisories/GHSA-58mr-gqgx-xq4g) |
| brace-expansion | high | 1.1.18 | >=1.1.20 | apps__api>@eslint/eslintrc>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) |
| brace-expansion | high | 2.1.4 | >=2.1.6 | apps__api>jest>@jest/core>@jest/reporters>glob>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) |
| brace-expansion | high | 5.0.9 | >=5.0.11 | apps__api>@nestjs/cli>glob>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) |
| brace-expansion | high | 1.1.18 | >=1.1.19 | apps__api>@eslint/eslintrc>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) |
| brace-expansion | high | 2.1.4 | >=2.1.5 | apps__api>jest>@jest/core>@jest/reporters>glob>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) |
| brace-expansion | high | 5.0.9 | >=5.0.10 | apps__api>@nestjs/cli>glob>minimatch>brace-expansion | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) |
| next | critical | 16.3.2 | >=16.3.6 | apps__web>next | [Next.js: Remote Code Execution in next/og ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) |
| source-map-js | high | 1.2.1 | >=1.2.2 | apps__web>@tailwindcss/postcss>@tailwindcss/node>source-map-js | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) |
| proxy-addr | critical | 2.0.7 | >=2.0.8 | apps__api>@nestjs/platform-express>express>proxy-addr | [proxy-addr vulnerable to IP spoofing via IPv4-mapped IPv6 trust subnet](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| tinypool | critical | 1.1.1 | >=2.1.1 | apps__web>vitest>tinypool | [Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) |
| tinypool | critical | 1.1.1 | >=2.1.2 | apps__web>vitest>tinypool | [Tinypool: Prototype Pollution Gadget to RCE in run() options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) |
| sharp | high | 0.35.3 | >=0.35.5 | apps__web>next>sharp | [sharp : Vulnerability in librsvg dependency CVE-2026-96889](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) |
| next | high | 16.3.2 | >=16.3.8 | apps__web>next | [Next.js has Server-Side Request Forgery in Image Optimization](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) |
| handlebars | critical | 4.7.9 | >=4.7.10 | apps__api>ts-jest>handlebars | [Handlebars: JavaScript Injection via AST Type Confusion in compile (bypass of CVE-2026-33937)](https://github.com/advisories/GHSA-8r5x-fm3f-whwj) |
| handlebars | critical | 4.7.9 | >=4.7.10 | apps__api>ts-jest>handlebars | [Handlebars: JavaScript Injection via Own Property Check Bypass](https://github.com/advisories/GHSA-p8wg-vrv2-v86f) |
| vite | high | 5.4.21, 6.4.3 | >=6.4.4 | apps__web>vite<br>apps__web>vitest>vite | [launch-editor: `fs.existsSync()` existence check can be bypassed on Windows](https://github.com/advisories/GHSA-587h-7wmj-h5pm) |
| next | critical | 16.3.2 | >=16.4.1 | apps__web>next | [Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used](https://github.com/advisories/GHSA-2464-fhr4-w9xw) |
| next | high | 16.3.2 | >=16.4.1 | apps__web>next | [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) |
| next | critical | 16.3.2 | >=16.4.1 | apps__web>next | [Next.js: Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays](https://github.com/advisories/GHSA-673q-mjm6-r5xr) |
| zod | high | 4.4.3 | >=4.6.6 | apps__web>eslint-config-next>eslint-plugin-react-hooks>zod | [Zod can exhaust memory while validating oversized constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| body-parser | high | 2.3.0 | >=2.4.0 | apps__api>@nestjs/platform-express>express>body-parser | [body-parser vulnerable to Denial of Service via trailing bytes after a compressed request body](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| multer | high | 2.2.0 | >=2.5.0 | apps__api>@nestjs/platform-express>multer | [multer vulnerable to Denial of Service via a pending asynchronous fileFilter after request teardown](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) |

## Residual production findings

| Package | Installed version | Severity | Fixed threshold | Conditions / follow-up |
|---|---|---|---|---|
| qs | 6.15.3 | moderate | >=6.16.0 | [qs array-limit bypass via bracket-key comma parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| qs | 6.15.3 | moderate | >=6.16.0 | [qs: Denial of Service via Attacker Controlled isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |
| qs | 6.15.3 | moderate | >=6.16.1 | [qs : qs.stringify with arrayFormat 'comma' throws an uncaught TypeError on array elements carrying a non-callable own toString (DoS)](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw) |

The production residuals concern qs parsing/stringifying. Express default query parsing, urlencoded-body configuration, input size and route reachability determine exposure. They are not dismissed by the staging gateway: review or patch them before broadening access. All moderate/low findings and full paths remain in the private JSON audit logs. No security rule or audit severity was disabled to obtain the critical/high result.

Build/tool major-version changes are accepted only with completed regression evidence in [PRIVATE_STAGING_VERIFICATION.md](PRIVATE_STAGING_VERIFICATION.md). No dependencies were installed into active development node_modules; the tested candidate has its own frozen installation. Root manifests and the promoted lockfile describe that candidate; existing local node_modules must be refreshed separately before using root commands.
