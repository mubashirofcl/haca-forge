import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

describe('Web App smoke tests', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: { code: 'UNAUTHORIZED' } }),
      })
    );
  });

  it('renders application without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });
});
