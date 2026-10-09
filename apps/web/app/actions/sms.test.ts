import { describe, it, expect } from 'vitest';
import { formatSriLankanPhoneNumber } from './sms';

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
