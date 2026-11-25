import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, fetchWithAuth } from '../api';
import { authService } from '@/services/authService';

describe('API Silent Refresh Interceptor', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('exports api object with standard HTTP methods', () => {
    expect(api).toBeDefined();
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.put).toBe('function');
    expect(typeof api.delete).toBe('function');
    expect(typeof api.patch).toBe('function');
  });

  it('coalesces concurrent 401s across api, authService, and fetchWithAuth into a single refresh call', async () => {
    let refreshCalls = 0;
    let journalsAttempts = 0;
    let verifyAttempts = 0;
    let streamAttempts = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'new-token',
            token_type: 'bearer',
            user: { id: 'u1', email: 'u1@test.com', is_verified: true, role: 'user' },
          }),
        };
      }
      if (url.endsWith('/journals')) {
        journalsAttempts += 1;
        if (journalsAttempts === 1) {
          return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail: 'Expired' }) };
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) };
      }
      if (url.endsWith('/auth/verify')) {
        verifyAttempts += 1;
        if (verifyAttempts === 1) {
          return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail: 'Expired' }) };
        }
        return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'u1@test.com' }) };
      }
      if (url.endsWith('/chat/stream')) {
        streamAttempts += 1;
        if (streamAttempts === 1) {
          return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail: 'Expired' }) };
        }
        return { ok: true, status: 200 };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const [journalsRes, verifyRes, streamRes] = await Promise.all([
      api.get('/journals'),
      authService.checkStatus(),
      fetchWithAuth('/chat/stream', { method: 'POST', body: '{}' }),
    ]);

    expect(refreshCalls).toBe(1);
    expect(journalsRes).toEqual({ items: [] });
    expect(verifyRes).toEqual({ id: 'u1', email: 'u1@test.com' });
    expect(streamRes.ok).toBe(true);
  });
});
