import {
  LayoutDashboard,
  FilePlus2,
  ShoppingCart,
  Users,
  FileText,
  Package,
  Boxes,
  Truck,
  History,
  BarChart3,
  Settings,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_ROLES, POS_ROLES, STAFF_ROLES, type AppRole } from '@/lib/roles';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match only this exact path (otherwise sub-paths are active too). */
  exact?: boolean;
  /** Sub-paths that belong to another item. */
  excludes?: string[];
  /** Roles that see this item. Defaults to the pharmacy staff roles. Display only: the API enforces access. */
  roles?: readonly AppRole[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Label workstation', href: '/label', icon: FilePlus2 },
      { label: 'Point of sale', href: '/pos', icon: ShoppingCart, roles: POS_ROLES },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Patients', href: '/admin/patients', icon: Users },
      { label: 'Prescriptions', href: '/admin/prescriptions', icon: FileText },
      { label: 'Label history', href: '/admin/labels', icon: History },
    ],
  },
  {
    title: 'Stock',
    items: [
      { label: 'Medicines', href: '/admin/products', icon: Package },
      { label: 'Inventory', href: '/admin/inventory', icon: Boxes, excludes: ['/admin/inventory/suppliers'] },
      { label: 'Suppliers', href: '/admin/inventory/suppliers', icon: Truck },
    ],
  },
  {
    title: 'Insights',
    items: [{ label: 'Analytics', href: '/admin/analytics', icon: BarChart3 }],
  },
  {
    title: 'System',
    items: [
      { label: 'Edit Reasons', href: '/admin/reasons', icon: Settings },
      { label: 'Audit log', href: '/admin/audit-log', icon: ScrollText, roles: ADMIN_ROLES },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

/**
 * The navigation a role may see. An unknown role (still loading, no role, or the lookup failed)
 * sees nothing rather than everything.
 */
export function navSectionsFor(role: AppRole | null | undefined): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => (item.roles ?? STAFF_ROLES).includes(role)),
  })).filter((section) => section.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  if (item.excludes?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const INVENTORY_TABS = [
  { href: '/admin/inventory', label: 'Overview', exact: true },
  { href: '/admin/inventory/batches', label: 'Batches' },
  { href: '/admin/inventory/expiry', label: 'Expiry' },
  { href: '/admin/inventory/low-stock', label: 'Low stock' },
  { href: '/admin/inventory/movements', label: 'Movements' },
  { href: '/admin/inventory/receiving', label: 'Receive stock' },
  { href: '/admin/inventory/adjustments', label: 'Adjustments' },
  { href: '/admin/inventory/returns', label: 'Returns' },
  { href: '/admin/inventory/analytics', label: 'Analytics' },
];
