/**
 * Roles as the web interface uses them, mirroring apps/api/src/auth/roles.ts.
 *
 * These decide what is SHOWN only. Every permission is enforced by the API; hiding a link never
 * grants or removes access.
 */
export type AppRole = 'admin' | 'pharmacist' | 'staff' | 'cashier';

/** Pharmacy staff roles: label workstation, records, inventory and administration pages. */
export const STAFF_ROLES: readonly AppRole[] = ['admin', 'pharmacist', 'staff'];

/** Administrators only: the audit log. */
export const ADMIN_ROLES: readonly AppRole[] = ['admin'];

/** Roles allowed to use the point of sale. */
export const POS_ROLES: readonly AppRole[] = [...STAFF_ROLES, 'cashier'];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Administrator',
  pharmacist: 'Pharmacist',
  staff: 'Staff',
  cashier: 'Cashier',
};

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/** Where a role starts after signing in. */
export function homeFor(role: AppRole | null | undefined): string {
  return role === 'cashier' ? '/pos' : '/';
}
