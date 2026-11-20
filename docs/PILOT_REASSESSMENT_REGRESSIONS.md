# Report 3 — Feature preservation matrix

Previous behavior below means behavior found in the preserved starting tree,
not a claim that the historical audit established hosted acceptance.

| Module | Starting behavior | Current behavior | Fresh evidence | Regression status |
|---|---|---|---|---|
| Authentication | API-verified login and roles; cookie-only logout | Same success/authorization contracts; thrown-provider errors now redacted | API suite, route/guard tests, 4 new controller tests, local DB workflows | PASS automated; refresh and provider logout acceptance NOT VERIFIED |
| Label workstation | Existing clinical instructions and incomplete-interval recovery | Unchanged | 2,181 web tests, including Workstation, interval, STAT, weekly, daily, EOD and print guards | PASS automated; pharmacist acceptance NOT VERIFIED |
| Label printing | Preview, print guards and stored history/reprint | Unchanged | Label fit/layout/printing tests and API prescription history tests | PASS automated; physical 70 × 50 mm output NOT VERIFIED |
| Patients | Create/edit/search/history | Unchanged | API/web patient tests and synthetic DB workflows | PASS automated; hosted acceptance NOT VERIFIED |
| Prescriptions | Legacy and opt-in transactional persistence | Unchanged | API unit and database integration suites; SQL rollback/concurrency | PASS regression; legacy batch-integrity launch gate FAIL |
| Products | Search/barcode/create/edit | Unchanged | API product tests; web ProductDialog/product-type tests; local workflows | PASS automated; hosted acceptance NOT VERIFIED |
| Inventory | GRN, batches, adjustments, returns | Unchanged | Inventory API tests; synthetic DB tests and SQL concurrency | PASS automated; physical reconciliation NOT VERIFIED |
| POS | Catalogue, local cart and lookup | Unchanged | POS API and web suites; cashier route restrictions | PASS automated; checkout/payment/invoice/sales persistence excluded |
| Dashboard | Existing metrics/reports | Unchanged | Admin API and dashboard web tests | PASS automated; live data accuracy NOT VERIFIED |
| Administration | Settings, reasons, audit viewer | Unchanged | Role boundary tests, settings/reasons/web tests and local reasons DB tests | PASS automated; complete audit actor attribution FAIL |
| SMS | Existing provider code with production block | Unchanged | Mocked SMS suite within full web run | PASS containment; no live sends; operational delivery excluded |

No public business API, migration, stock policy, clinical string, dose computation,
feature flag or UI was altered by this session. Passing tests establish the scope
they execute; they do not establish complete clinical or operational equivalence.
No hosted browser E2E or physical printer acceptance was performed.
