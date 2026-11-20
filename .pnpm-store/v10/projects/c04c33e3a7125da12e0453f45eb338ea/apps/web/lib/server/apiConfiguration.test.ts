import { describe, expect, it } from 'vitest';
import { apiBaseUrl, loginApiUrls } from './apiConfiguration';

describe('production API binding', () => {
  const production: NodeJS.ProcessEnv = { NODE_ENV: 'production', API_URL: 'https://api.example.invalid', PILOT_API_URL: 'https://api.example.invalid' };
  it('uses exactly the approved production API, without local fallbacks', () => {
    expect(loginApiUrls(production)).toEqual(['https://api.example.invalid']);
  });
  it.each([
    { API_URL: '' },
    { API_URL: 'https://different.example.invalid' },
    { API_URL: 'http://api.example.invalid' },
    { API_URL: 'https://api.example.invalid/path' },
    { PILOT_API_URL: '' },
  ])('rejects missing or mismatched configuration: %j', (overrides) => {
    expect(() => apiBaseUrl({ ...production, ...overrides })).toThrow(/PILOT_API_URL/);
  });
  it('preserves local development defaults', () => {
    expect(apiBaseUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3001');
    expect(loginApiUrls({ NODE_ENV: 'test' })).toContain('http://127.0.0.1:3001');
  });
});
