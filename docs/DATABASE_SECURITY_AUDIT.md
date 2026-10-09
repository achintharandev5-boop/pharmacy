# Database and Authentication Security Audit

Date: 2026-10-10 · Branch `feature/ui-ux-redesign` · Covers Phase 0 findings S1–S4 and the database.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| A1 | Supabase secret key and admin password were hardcoded (Phase 0 S3) | Critical | Removed from code. **Rotation still required: owner action** |
| A2 | RLS disabled on every table: the public REST API exposes all data to anyone with the publishable key | Critical | Fixed in migration `000400`. **Not yet applied** |
| A3 | API authentication failed open when `NODE_ENV` was unset (S1) | Critical | **Fixed** and tested |
| A4 | No roles or permissions (S2) | High | **Fixed** in the API (admin / pharmacist / staff) |
| A5 | Login stored the user's session on the shared service-role client | High | **Fixed** |
| A6 | API fell back to `dummy_key` / localhost when configuration was missing | Medium | **Fixed**: refuses to start |
| A7 | Stock writes were read-then-write (lost updates under concurrency) | High | Prescriptions: compare-and-set, **fixed**. Receiving/adjustments: row-locked DB functions, **pending migration** |
| A8 | Database errors and Postgres messages could reach logs with patient values | Medium | **Fixed**: logs carry operation and error code only |
| A9 | No rate limiting on `POST /auth/login` | Medium | Open (see Remaining) |
| A10 | Web session cookie holds the Supabase access token for up to its lifetime; no refresh or server-side revocation on logout | Medium | Open |

## A1. Credential rotation procedure (owner action)

The values are not reproduced anywhere in the repository. Do these steps in order:

1. **Rotate the Supabase secret key.** Dashboard → Project Settings → API Keys. Create a new secret key, then **revoke** the old `sb_secret_…` key (creating a new one alone does not invalidate the old one). If the project still uses the legacy JWT `service_role` key, rotate the JWT secret instead; note that this also signs out every user.
2. Put the new key in `apps/api/.env` (`SUPABASE_SERVICE_ROLE_KEY`) on every machine that runs the API, and in the hosting provider's secrets. Restart the API. It will refuse to start if the key is missing.
3. **Change the admin password.** Dashboard → Authentication → Users → the admin user → Reset password (or `supabase.auth.admin.updateUserById`). Use a new password not used elsewhere.
4. **Review Authentication → Users** for accounts you do not recognise, and the Auth logs for sign-ins since the key was first committed. Delete unknown accounts.
5. **Review data for tampering** since the exposure: recent rows in `customers`, `products` (`stock_quantity`), `prescriptions`. Database → Logs shows API activity by key.
6. Assign roles to the real accounts (`node --env-file=.env scripts/set-user-role.js <email> admin`). Accounts without a role can use the workstation but cannot change stock or suppliers.
7. Treat `../pharmacy-label-backup-20261009-pre-redesign.tar.gz` as secret: it contains the original files and `.env` files. Store it encrypted or delete it once no longer needed.
8. If the repository was ever pushed to a remote with the old files, assume the key is public even after rotation, and check the remote's history. The current repository history does not contain the values (they were removed before the first commit).

## A2. Row Level Security

Supabase grants the `anon` and `authenticated` roles full privileges on tables in `public` by default. With RLS off, the REST endpoint `https://<project>.supabase.co/rest/v1/<table>` lets anyone holding the **publishable key** read, insert, update and delete every patient, prescription and stock record. The publishable key is designed to be public, so this is equivalent to no access control.

Migration `20261010000400_row_level_security.sql` enables RLS on all 17 application tables with no policies for those roles, and revokes their access to the stock functions, sequences and helper. The API uses the service-role key, which bypasses RLS, so it is unaffected. Verified on a local database with Supabase's default grants: `anon` and `authenticated` see zero rows, cannot insert, and cannot execute `receive_stock`/`adjust_stock`; `service_role` works normally.

The web app's `.env` contains a publishable key (`sb_publishable_…`, checked by prefix only). It is not referenced by any code, so it is not shipped to browsers today. Once RLS is on it grants nothing even if it is.

## A3–A6. API authentication

- **Fail closed.** `AuthGuard` is global. Every route needs a valid Supabase access token unless it carries `@Public()`. The allowlist is `GET /health` and `POST /auth/login`. There is no environment-based bypass. Tokens are verified by Supabase Auth (`auth.getUser`), which checks signature, expiry and revocation. An unreachable auth service returns 503, never access.
- **Roles.** `RolesGuard` reads `app_metadata.role`, which only the service-role key can set. Users cannot change their own role.

  | Action | admin | pharmacist | staff | no role |
  |---|:-:|:-:|:-:|:-:|
  | Label workstation, create/print prescriptions, SMS log | ✓ | ✓ | ✓ | ✓ |
  | View patients, prescriptions, inventory, dashboard | ✓ | ✓ | ✓ | ✓ |
  | Create patient | ✓ | ✓ | ✓ | ✓ |
  | Receive stock (GRN), adjust stock, write off expired | ✓ | ✓ | ✗ | ✗ |
  | Create / edit suppliers | ✓ | ✓ | ✗ | ✗ |
  | Delete patient | ✓ | ✗ | ✗ | ✗ |

  The workstation and read access are open to any signed-in user so existing accounts are not locked out before roles are assigned. Tightening "no role" to read-nothing is a one-line change once every account has a role.
- **Login client.** `signInWithPassword` stores the resulting session on the client that called it. It was called on the shared service-role client, so after any login, later API queries could run with that user's token. Login now uses a throwaway client, and the response contains only token fields.
- **Configuration.** `validateEnv` rejects a missing or placeholder key, an invalid URL, port or time zone. Error output names the variable, never its value.

Tests: `src/auth/auth.guard.spec.ts` (missing, malformed, invalid, expired token; NODE_ENV unset/development/production; auth outage; role matrix) and `src/app.security.spec.ts`, which boots the real application and sends unauthenticated and forged-token requests to **every registered route**, asserting 401 for all but the allowlist.

## A7. Transactions and concurrency

- `receive_stock` and `adjust_stock` lock the product and batch rows (`SELECT … FOR UPDATE`) and do all writes in one transaction. A local two-session test confirmed one of two simultaneous 10-unit withdrawals from 15 units is refused and the ledger balances.
- Prescriptions (until `create_prescription` is adopted) use compare-and-set stock updates (`UPDATE … WHERE stock_quantity = <value read>`), so concurrent dispensing cannot spend the same units, and reverse completed steps if a later step fails. If the reversal itself fails, the API reports `RECONCILIATION_REQUIRED` with the prescription id and logs it.
- Idempotency keys prevent a retried request from dispensing or receiving twice.

## A8. Logging

- API: database failures log `"<operation> failed (<code>)"`. Postgres messages and details, which can include names and phone numbers, are not logged. Tokens, passwords and request bodies are never logged.
- Web: server actions log method, path (without query string) and status only (Phase 0).
- The SMS action still logs the Text.lk error response object on failure; see Remaining.

## Functions

All three database functions are `SECURITY INVOKER` with a fixed `search_path`, so they run with the caller's (the API's) privileges and cannot be hijacked by objects in other schemas. Execute is revoked from `PUBLIC`, `anon` and `authenticated`. The audit trigger copies field names, not values.

## Remaining

1. Rotate credentials (A1). **Blocker for production.**
2. Apply migrations `000100`–`000400` (A2). **Blocker for production.**
3. Rate-limit `POST /auth/login` (for example `@nestjs/throttler`, or rely on Supabase Auth's own limits and confirm them in the dashboard).
4. Session handling: the web cookie stores the access token without refresh; on expiry the user must sign in again. Logout clears the cookie but does not revoke the token server-side (`auth.admin.signOut`).
5. `apps/web/app/actions/sms.ts` logs the gateway's error payload; reduce it to status and error code.
6. Generate Supabase TypeScript types so queries are type-checked; the API's lint errors are almost all untyped-`any` warnings from the Supabase client.
7. Upgrade Node to 22 LTS (supabase-js warns that Node 20 support is ending).
