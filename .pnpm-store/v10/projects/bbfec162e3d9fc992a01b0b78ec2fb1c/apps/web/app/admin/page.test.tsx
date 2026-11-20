import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './page';

const api = vi.hoisted(() => ({
  summary: vi.fn(), inventory: vi.fn(), activity: vi.fn(), movementActivity: vi.fn(), top: vi.fn(), recent: vi.fn(), lowStock: vi.fn(), expiries: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }}>{children}</a>
  ),
}));
vi.mock('@/app/actions/admin', () => ({
  getAdminSummary: api.summary,
  getAdminActivity: api.activity,
  getAdminTopProducts: api.top,
}));
vi.mock('@/app/actions/inventory', () => ({
  getInventorySummary: api.inventory,
  getInventoryLowStock: api.lowStock,
  getDashboardExpiryBatches: api.expiries,
  getDashboardMovementActivity: api.movementActivity,
}));
vi.mock('@/app/actions/prescriptions', () => ({ getPrescriptionHistory: api.recent }));
vi.mock('@/components/ui/Charts', () => ({
  ChartTable: () => null,
  DailyLineChart: ({ series }: { series: { name: string }[] }) => <div role="img" aria-label={series.map((item) => item.name).join(' and ')} />,
  ColumnChart: ({ valueName }: { valueName: string }) => <div role="img" aria-label={valueName} />,
  HorizontalBarChart: ({ valueName }: { valueName: string }) => <div role="img" aria-label={valueName} />,
}));

const ok = <T,>(data: T) => ({ ok: true as const, data });
const sampleSummary = {
  asOf: '2026-10-20T00:00:00.000Z',
  timeZone: 'Asia/Colombo',
  totalPatients: 28,
  inventory: { lowStock: 7 },
  today: { prescriptions: 4, inventoryMovements: 3 },
};
const sampleInventory = {
  totalProducts: 52,
  stock: { healthy: 35, low: 5, critical: 2, outOfStock: 4, unclassified: 6 },
  expiry: { expired: 1, within30Days: 3 },
};

describe('dashboard API states', () => {
  beforeEach(() => {
    api.summary.mockReset().mockResolvedValue(ok(sampleSummary));
    api.inventory.mockReset().mockResolvedValue(ok(sampleInventory));
    api.activity.mockReset().mockResolvedValue(ok([]));
    api.movementActivity.mockReset().mockResolvedValue(ok([]));
    api.top.mockReset().mockResolvedValue(ok([]));
    api.recent.mockReset().mockResolvedValue(ok([]));
    api.lowStock.mockReset().mockResolvedValue(ok([]));
    api.expiries.mockReset().mockResolvedValue(ok([]));
  });

  it('shows loading feedback while dashboard APIs are pending', () => {
    api.summary.mockReturnValue(new Promise(() => {}));
    api.inventory.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.getByText('Total medicines')).toBeInTheDocument();
  });

  it('renders confirmed metrics and displays API errors with retry feedback', async () => {
    api.summary.mockResolvedValue({ ok: false, error: 'Dashboard service unavailable' });
    render(<DashboardPage />);
    expect(await screen.findByText('Dashboard service unavailable')).toBeInTheDocument();
    expect(await screen.findByText('52')).toBeInTheDocument();
    expect(await screen.findByText('3', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Batches expiring ≤ 30 days')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(2));
  });

  it('renders pharmacy counts only when their summary APIs succeed', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('52')).toBeInTheDocument();
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(await screen.findByText('28')).toBeInTheDocument();
  });

  it('refreshes date-filtered charts when the selected range changes', async () => {
    render(<DashboardPage />);
    await screen.findByText('52');
    fireEvent.click(screen.getByRole('radio', { name: '30 days' }));
    await waitFor(() => expect(api.activity).toHaveBeenCalledWith('30d'));
    expect(api.movementActivity).toHaveBeenCalledWith('30d');
  });
});

it('shows the actual dashboard with unavailable metrics and no fictional records in UI testing', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_UI_TEST_MODE', 'true');
  try {
    for (const endpoint of Object.values(api)) endpoint.mockResolvedValue({ ok: false, error: 'UI testing mode: No data loaded. Database connection is disabled.' });
    render(<DashboardPage />);
    expect(screen.getByText('Welcome, UI Tester')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create Test Label' })).toHaveAttribute('href', '/label');
    await waitFor(() => expect(screen.getAllByText('No data loaded').length).toBeGreaterThan(5));
    expect(screen.queryByText('28')).not.toBeInTheDocument();
    expect(screen.queryByText(/DEMO-B/)).not.toBeInTheDocument();
  } finally { vi.unstubAllEnvs(); }
});
