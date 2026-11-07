import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { apiFetch } from '../lib/api';
import { AuthProvider, useAuth } from '../context/AuthContext';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const user = { _id: 'u1', id: 'u1', name: 'Cookie User', role: 'team_member', email: 'u1@test' };

let fetchMock: ReturnType<typeof vi.fn>;

/** A plain Storage for these tests; Node's own localStorage global has no methods without a file. */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  dump() { return Object.fromEntries(this.map); }
}
let local: MemoryStorage;
let session: MemoryStorage;

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  Object.defineProperty(window, 'localStorage', { value: local, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: session, configurable: true });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const storedTokens = () =>
  ['accessToken', 'refreshToken', 'token'].flatMap((k) => [local.getItem(k), session.getItem(k)]).filter(Boolean);

describe('apiFetch with cookie sessions', () => {
  it('never sends an Authorization header, even if an old token is in storage', async () => {
    local.setItem('accessToken', 'old-token');
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await apiFetch('/api/thing');
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(init.credentials).toBe('include');
  });

  it('on an expired session, refreshes from the cookie once and retries once', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'TOKEN_EXPIRED' } }))
      .mockResolvedValueOnce(json(200, { user }))
      .mockResolvedValueOnce(json(200, { value: 42 }));
    const data = await apiFetch<{ value: number }>('/api/thing');
    expect(data.value).toBe(42);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1];
    expect(refreshUrl).toBe('/api/auth/refresh');
    expect(refreshInit.credentials).toBe('include');
    expect(refreshInit.body).toBeUndefined();
    expect(fetchMock.mock.calls[2][0]).toBe('/api/thing');
  });

  it('shares one refresh between requests that expire together', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/refresh') return json(200, {});
      const calls = fetchMock.mock.calls.filter(([u]) => u === url).length;
      return calls === 1 ? json(401, {}) : json(200, { url });
    });
    await Promise.all([apiFetch('/api/a'), apiFetch('/api/b')]);
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/auth/refresh')).toHaveLength(1);
  });

  it('does not loop when the refresh also fails', async () => {
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {}));
    await expect(apiFetch('/api/thing')).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function LoginProbe() {
  const { login, logout, user: current } = useAuth();
  return (
    <div>
      <span data-testid="who">{current?.name || 'nobody'}</span>
      <button onClick={() => login({ email: 'u1@test', password: 'x' })}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider keeps no login token in browser storage', () => {
  it('clears tokens left by an older version when the app starts', async () => {
    local.setItem('accessToken', 'a');
    local.setItem('refreshToken', 'r');
    local.setItem('token', 't');
    session.setItem('token', 's');
    fetchMock.mockResolvedValue(json(401, {}));
    render(<AuthProvider><LoginProbe /></AuthProvider>);
    await waitFor(() => expect(storedTokens()).toEqual([]));
  });

  it('stores nothing at login, even if a server sent tokens in the body', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/login') return json(200, { user, permissions: [], accessToken: 'a', refreshToken: 'r' });
      if (url === '/api/auth/me') return json(401, {});
      return json(401, {});
    });
    render(<AuthProvider><LoginProbe /></AuthProvider>);
    // Let the start-up session check (no session yet) finish before logging in.
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => u === '/api/auth/refresh')).toBe(true));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('Cookie User'));
    expect(storedTokens()).toEqual([]);
    expect(JSON.stringify(local.dump())).not.toMatch(/accessToken|refreshToken/);
  });

  it('logout leaves nothing in storage', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') return json(200, { user, permissions: [] });
      return json(200, {});
    });
    render(<AuthProvider><LoginProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('Cookie User'));
    local.setItem('accessToken', 'sneaked-in');
    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('nobody'));
    expect(storedTokens()).toEqual([]);
  });
});
