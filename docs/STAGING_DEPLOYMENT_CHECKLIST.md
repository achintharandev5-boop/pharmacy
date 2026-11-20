# Staging Deployment Checklist

Status: **not started. Nothing has been applied to any Supabase project.** Production stays out of scope until every box below is ticked on staging and the owner approves.

Use this list in order. Every step points to the detailed procedure in `SUPABASE_DEPLOYMENT_GUIDE.md` (the "guide"). Tick a box only when the expected result was seen; write anything unexpected in the Notes column of guide §9.

## A. Before touching any database

- [ ] **Old Supabase secret key revoked** and a new one created. The old key is not used anywhere below. (Guide G1, `DATABASE_SECURITY_AUDIT.md` A1)
- [ ] **Admin password changed.** (G2)
- [ ] New secret key stored only in the staging API's environment and the operator's local `apps/api/.env`. (G3)
- [ ] Staging is a **separate** Supabase project or branch, restored from a fresh backup of production. It is **not** the production project.
- [ ] Staging API configured with `PRESCRIPTION_WRITE_MODE=legacy` (or unset). (G6)
- [ ] The person running the steps has read guide §8.1 (steps that re-open public access).

## B. Compatibility (read-only, on staging and again on production)

- [ ] §1.1 Postgres version ≥ 15; migration history recorded; path A or B chosen.
- [ ] §1.2 all 13 tables present.
- [ ] §1.3 all referenced columns present.
- [ ] §1.4 none of the new tables, sequences or functions already exists in another shape; existing triggers and policies noted.
- [ ] §1.5 counts of rows the new constraints would flag, saved.
- [ ] §1.6 no legitimate direct REST users of the publishable key.
- [ ] §1.7 results (undated batches, expired batches with stock, batch drift, default-looking thresholds, historical `RETURNED`) handed to the pharmacist.

## C. Backup

- [ ] §2 step 1: platform backup time (and point-in-time restore point, if available) written down.
- [ ] §2 step 2: logical dump and schema dump taken, stored outside the repository, encrypted.
- [ ] §2 step 3: dump lists 13 `TABLE DATA` entries.
- [ ] §2 step 4: row counts written down.

## D. Apply (staging)

- [ ] Migrations applied in the order of guide §3: `000100` → `000200` → `000300` → `000400` → `000500`, all in one session. Each reported success.
- [ ] `seed.sql` **not** run; `db reset` **not** used; no `--include-seed`.
- [ ] Migration history repaired if path B was used (§4).

## E. Verify the database (staging)

- [ ] §5.1 five new tables, eight functions, one settings row with no invented values, no threshold defaults.
- [ ] §5.2 row counts identical to §2 step 4; every existing patient `UNKNOWN` allergy status.
- [ ] §5.3 `anon` and `authenticated` cannot execute any of the five stock functions; `service_role` can.
- [ ] §5.4 constraints listed; validated if §1.5 was all zero, otherwise rows given to the pharmacist.
- [ ] §6.1 RLS on for every table (including `patient_returns`).
- [ ] §6.2 exactly one policy (`user_profiles_self_read`).
- [ ] §6.3–6.6 `anon`/`authenticated` read nothing, cannot write, cannot call stock functions.
- [ ] External `curl` with the publishable key returns `[]` and refuses an insert.

## F. Roles (staging users first)

- [ ] Owner has confirmed in writing which person gets which role (guide §7). Unrecognised accounts disabled, not given a role.
- [ ] Roles assigned with `scripts/set-user-role.js` using the new key; checked with the `auth.users` query.

## G. Deploy the API and web app to staging

- [ ] API from `feature/ui-ux-redesign`, new key, `PRESCRIPTION_WRITE_MODE=legacy`.
- [ ] Web app pointed at the staging API. No Supabase key in the web app's environment.
- [ ] `GET /health` answers; every other route without a token answers 401.

## H. End-to-end on staging (clearly named test records only)

Use records named `TEST — staging — delete`. Never send an SMS to a real patient: use the owner's own phone number.

- [ ] 1. Sign in as each role; the account menu shows the right role; a wrong password is refused.
- [ ] 2. Staff cannot receive stock, adjust, quarantine, create medicines or suppliers; pharmacist can; only admin can delete a patient.
- [ ] 3. Create a test patient; it appears in search; `audit_log` has the insert.
- [ ] 4. Create a test medicine; no stock, expiry or thresholds are filled in; Inventory shows "Not configured".
- [ ] 5. Create a test supplier.
- [ ] 6. Receive a test delivery with two batches (future expiry). Retrying the same submission does not double the stock. A line with a past expiry is refused and nothing from that delivery is saved.
- [ ] 7. Record a count correction with a reason; record a supplier return against a batch; record a patient return (stock unchanged); dispose of it as pharmacist.
- [ ] 8. Label workstation: build a label for the test medicine, save, print. Stock reduces; the Sinhala instruction text on the printed label and in the prescription record is identical to before the upgrade.
- [ ] 9. Quarantine a batch; dispensing more than the remaining eligible stock is refused; release it.
- [ ] 10. Reprint with a reason; print count increases.
- [ ] 11. Send one SMS to the owner's phone; the event is recorded. Signed out, the SMS action is refused.
- [ ] 12. Inventory overview, batches, expiry, low stock, movements and dashboard show the test records and nothing invented.
- [ ] 13. A label with a past expiry (`2001-01-31`) is refused.
- [ ] 14. `audit_log` shows the changes above with the right users.
- [ ] Ledger check: `select bool_and(stock_after = stock_before + quantity) from inventory_movements;` is `true`.
- [ ] Test records deleted or clearly marked; none copied to production.

## I. Optional on staging: transactional prescription mode (only after pharmacist decision D1)

- [ ] Pharmacist has signed off the allocation rules in `STAGING_READINESS_REPORT.md` §7 (D1–D3).
- [ ] §1.7(c) batch drift reconciled on staging (batch quantities match product totals).
- [ ] Staging API restarted with `PRESCRIPTION_WRITE_MODE=transactional`.
- [ ] Dispense a test label larger than the earliest batch: units come from the earliest-expiring eligible batches first; batch quantities and product total stay equal; the ledger has one row per batch.
- [ ] Retry the same save (same idempotency key): no second prescription.
- [ ] Switch back to `legacy` unless the owner approves keeping it.

## J. Sign-off

- [ ] Guide §9 sign-off record completed for staging.
- [ ] Owner decision recorded: proceed to production, or not.

Production uses the same list from section B onward, with real (not test) records in section H limited to genuine work, and `PRESCRIPTION_WRITE_MODE` as decided in section I.
