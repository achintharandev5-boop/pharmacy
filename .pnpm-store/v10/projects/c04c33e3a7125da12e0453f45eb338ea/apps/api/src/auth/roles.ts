/**
 * Application roles.
 *
 * A user's role is read from Supabase Auth `app_metadata.role`. `app_metadata` can only be
 * written with the service-role key (never by the user), so it is safe to trust for
 * authorization. Assign roles with `scripts/set-user-role.js`.
 *
 * A signed-in user without a recognised role is refused on every route except the public ones
 * and `GET /auth/me`. A route without @Roles() is limited to ALL_ROLES (see RolesGuard).
 */
export enum Role {
  Admin = 'admin',
  Pharmacist = 'pharmacist',
  Staff = 'staff',
  /** Point of sale only (approved decision D-10). Not part of ALL_ROLES. */
  Cashier = 'cashier',
}

/** Pharmacy staff roles: label workstation, records and dispensing. Excludes Cashier. */
export const ALL_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Pharmacist,
  Role.Staff,
];

/** Every role the API recognises. */
export const KNOWN_ROLES: readonly Role[] = [...ALL_ROLES, Role.Cashier];

/** Roles allowed to change stock levels, suppliers and goods receipts. */
export const STOCK_MANAGERS: readonly Role[] = [Role.Admin, Role.Pharmacist];

/** Roles allowed to use the point of sale. */
export const POS_SELLERS: readonly Role[] = [...ALL_ROLES, Role.Cashier];

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' &&
    (KNOWN_ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

export interface AuthUser {
  pharmacyId?: string;
  id: string;
  email: string | null;
  role: Role | null;
}
