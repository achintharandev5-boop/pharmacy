import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'token' }) }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { formatSriLankanPhoneNumber, sendClientSms } from './sms';

describe('sendClientSms', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TEXT_LK_API_TOKEN', 'sms-token');
    vi.stubEnv('TEXT_LK_SENDER_ID', 'PHARMACY');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const smsGatewayCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('text.lk'));

  it('does not contact the SMS gateway when the session is not valid', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
    const res = await sendClientSms({ recipient: '0771234567', message: 'x' });
    expect(res.success).toBe(false);
    expect(smsGatewayCalls()).toHaveLength(0);
  });

  it('sends once the API confirms the session', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', email: 'a@b.c', role: 'pharmacist' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: { uid: 'm1' } }), { status: 200 }));
    const res = await sendClientSms({ recipient: '0771234567', message: 'x' });
    expect(res.success).toBe(true);
    expect(smsGatewayCalls()).toHaveLength(1);
  });
});


describe('formatSriLankanPhoneNumber', () => {
  it('formats 10-digit number starting with 0', async () => {
    const result = await formatSriLankanPhoneNumber('0771234567');
    expect(result).toBe('94771234567');
  });

  it('formats number with +94 country code', async () => {
    const result = await formatSriLankanPhoneNumber('+94712345678');
    expect(result).toBe('94712345678');
  });

  it('formats 9-digit number without leading 0', async () => {
    const result = await formatSriLankanPhoneNumber('771234567');
    expect(result).toBe('94771234567');
  });

  it('keeps already formatted 94 number as is', async () => {
    const result = await formatSriLankanPhoneNumber('94710000000');
    expect(result).toBe('94710000000');
  });

  it('cleans dashes and spaces', async () => {
    const result = await formatSriLankanPhoneNumber('077 - 123 4567');
    expect(result).toBe('94771234567');
  });
});
