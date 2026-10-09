/**
 * Application roles.
 *
 * A user's role is read from Supabase Auth `app_metadata.role`. `app_metadata` can only be
 * written with the service-role key (never by the user), so it is safe to trust for
 * authorization. Assign roles with `scripts/set-user-role.js`.
 *
 * A signed-in user without a recognised role can use the label workstation and read
 * records, but cannot perform any action protected by @Roles().
 */
export enum Role {
  Admin = 'admin',
  Pharmacist = 'pharmacist',
  Staff = 'staff',
}

export const ALL_ROLES: readonly Role[] = [Role.Admin, Role.Pharmacist, Role.Staff];

/** Roles allowed to change stock levels, suppliers and goods receipts. */
export const STOCK_MANAGERS: readonly Role[] = [Role.Admin, Role.Pharmacist];

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && (ALL_ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

export interface AuthUser {
  id: string;
  email: string | null;
  role: Role | null;
}
