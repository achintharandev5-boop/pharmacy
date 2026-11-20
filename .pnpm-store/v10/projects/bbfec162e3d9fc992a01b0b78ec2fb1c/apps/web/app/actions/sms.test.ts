import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/uiTestMode', () => ({ uiTestEnabled: () => false, UI_TEST_NOT_SAVED: 'Not saved' }));
import { getCurrentUser } from './auth';
import { sendClientSms } from './sms';

describe('pilot SMS containment', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.clearAllMocks();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each([undefined, '', 'false', 'TRUE'])('does not contact auth or the provider when SMS_ENABLED=%s', async (flag) => {
    vi.stubEnv('SMS_ENABLED', flag);
    expect(await sendClientSms({ recipient: '0700000000', message: 'Synthetic test' }))
      .toEqual({ success: false, error: 'SMS is disabled for this deployment.' });
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps production SMS disabled even if the legacy switch is enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMS_ENABLED', 'true');
    expect((await sendClientSms({ recipient: '0700000000', message: 'Synthetic test' })).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it.each(['staff', 'cashier', null] as const)('refuses a %s account on the non-production legacy path', async (role) => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SMS_ENABLED', 'true');
    vi.mocked(getCurrentUser).mockResolvedValue({ ok: true, data: { id: 'synthetic', email: null, role } });
    expect((await sendClientSms({ recipient: '0700000000', message: 'Synthetic test' })).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
