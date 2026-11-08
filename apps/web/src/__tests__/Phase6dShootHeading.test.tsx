import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../lib/api', () => ({ apiFetch: vi.fn(async () => ({ data: { clips: [] } })) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'u1', role: 'team_member' }, hasPermission: () => false }) }));
vi.mock('../hooks/useSocket', () => ({ useSocket: () => ({ on: () => () => {}, emit: vi.fn() }) }));

import { ShootReviewView } from '../pages/work/workspaces/ShootReviewView';

describe('Shoot review heading', () => {
  it('a participant\'s read-only view says "Approved footage"', () => {
    render(<ShootReviewView stageItemId="s1" workItemTitle="Shoot" readOnly />);
    expect(screen.getByText('Approved footage')).toBeInTheDocument();
    expect(screen.queryByText('Creative Head Review')).not.toBeInTheDocument();
  });

  it('the reviewer\'s view still says "Creative Head Review"', () => {
    render(<ShootReviewView stageItemId="s1" workItemTitle="Shoot" />);
    expect(screen.getByText('Creative Head Review')).toBeInTheDocument();
  });
});
