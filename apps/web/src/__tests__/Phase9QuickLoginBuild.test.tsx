import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DevQuickLogin, groupQuickLogins, type QuickLoginAccount } from '../components/DevQuickLogin';

const ROOT = path.resolve(__dirname, '../..');
const DIST = path.join(ROOT, 'dist');
const acc = (label: string, role: string, i: number): QuickLoginAccount => ({ label, role, email: `${label.toLowerCase().replace(/\W/g, '')}${i}@demo.haca.local`, password: 'not-a-real-password' });
const ACCOUNTS = [
  acc('Admin', 'admin', 0),
  acc('Creative Head', 'creative_head', 1),
  acc('SM Manager', 'sm_manager', 2),
  acc('Executive', 'executive', 3),
  ...['Writer 1', 'Writer 2', 'Designer 1', 'Designer 2', 'Shooter', 'Editor 1', 'Editor 2', 'Poster', 'All-rounder'].map((l, i) => acc(l, 'team_member', 10 + i)),
];

describe('Quick sign in (dev only)', () => {
  it('groups the accounts by role, one click each', () => {
    const onPick = vi.fn();
    render(<DevQuickLogin accounts={ACCOUNTS} onPick={onPick} />);
    const groups = screen.getAllByTestId('quick-login-group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Admin', 'Creative Head', 'SM Manager', 'Executive', 'Team members']);
    expect(within(groups[4]).getAllByRole('button')).toHaveLength(9);
    within(groups[4]).getByRole('button', { name: 'Poster' }).click();
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Poster', role: 'team_member' }));
  });

  it('accounts without a role still show, under Other', () => {
    expect(groupQuickLogins([{ label: 'X', email: 'x@y.z', password: 'p' }]).map((g) => g.title)).toEqual(['Other']);
  });

  // The gate builds the web app before running these tests, so dist/ is the production build.
  it.skipIf(!fs.existsSync(DIST))('is absent from the production build', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|html|css|map)$/.test(e.name)) files.push(p);
      }
    };
    walk(DIST);
    expect(files.length).toBeGreaterThan(0);
    const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(text).not.toContain('Quick sign in');
    expect(text).not.toContain('Local development only');
    expect(text).not.toMatch(/@demo\.haca\.local/);
    expect(text).not.toContain('VITE_QUICK_LOGINS');
    // The encoded list from .env.local, when present, must not be in the bundle either.
    const envLocal = path.join(ROOT, '.env.local');
    if (fs.existsSync(envLocal)) {
      const m = fs.readFileSync(envLocal, 'utf8').match(/^VITE_QUICK_LOGINS=(.+)$/m);
      if (m) expect(text.includes(m[1].trim())).toBe(false);
    }
  });
});
