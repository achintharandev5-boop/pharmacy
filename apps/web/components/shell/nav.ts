import {
  LayoutDashboard,
  FilePlus2,
  Users,
  FileText,
  Package,
  Boxes,
  Truck,
  History,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match only this exact path (otherwise sub-paths are active too). */
  exact?: boolean;
  /** Sub-paths that belong to another item. */
  excludes?: string[];
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
    items: [{ label: 'Settings', href: '/admin/settings', icon: Settings }],
  },
];

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
  { href: '/admin/inventory/analytics', label: 'Analytics' },
];
