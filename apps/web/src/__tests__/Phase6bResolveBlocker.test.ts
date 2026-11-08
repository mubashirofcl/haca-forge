import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../lib/api';
import { resolveStepBlocker } from '../lib/blockers';

const api = apiFetch as unknown as ReturnType<typeof vi.fn>;

describe('resolveStepBlocker (My Work and Work Detail)', () => {
  beforeEach(() => api.mockReset());

  it('resolves the active blocker record', async () => {
    api.mockResolvedValueOnce({ data: [{ _id: 'b1' }] }).mockResolvedValueOnce({ success: true });
    await resolveStepBlocker('w1');
    expect(api.mock.calls[0][0]).toBe('/api/blockers?workItemId=w1&status=Active');
    expect(api.mock.calls[1][0]).toBe('/api/blockers/b1/resolve');
    expect(api.mock.calls[1][1]).toMatchObject({ method: 'PATCH' });
    // No resume status: the API returns the step to its status before the blocker.
    expect(JSON.parse(api.mock.calls[1][1].body)).not.toHaveProperty('resumeStatus');
  });

  it('a step blocked before records were kept is moved out of Blocked the old way', async () => {
    api.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ success: true });
    await resolveStepBlocker('w2');
    expect(api.mock.calls[1][0]).toBe('/api/work-items/w2/transition');
    expect(JSON.parse(api.mock.calls[1][1].body)).toMatchObject({ toStatus: 'In Progress' });
  });
});
