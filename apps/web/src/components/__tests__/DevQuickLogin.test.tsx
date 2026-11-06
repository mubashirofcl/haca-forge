import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevQuickLogin, parseQuickLogins } from '../DevQuickLogin';

const account = { label: 'Writer 1', email: 'writer@example.test', password: 'not-a-real-password' };

describe('DevQuickLogin', () => {
  it('reads the base64 list and ignores bad values', () => {
    expect(parseQuickLogins(btoa(JSON.stringify([account, { label: 'No email' }])))).toEqual([account]);
    expect(parseQuickLogins(undefined)).toEqual([]);
    expect(parseQuickLogins('')).toEqual([]);
    expect(parseQuickLogins('not base64 json')).toEqual([]);
    expect(parseQuickLogins(btoa('{"not":"a list"}'))).toEqual([]);
  });

  it('shows nothing without accounts', () => {
    const { container } = render(<DevQuickLogin accounts={[]} onPick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('signs in with the picked account and never shows its password', () => {
    const onPick = vi.fn();
    const { container } = render(<DevQuickLogin accounts={[account]} onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Writer 1' }));
    expect(onPick).toHaveBeenCalledWith(account);
    expect(container.innerHTML).not.toContain(account.password);
  });

  it('cannot be clicked while a sign-in is running', () => {
    render(<DevQuickLogin accounts={[account]} busy onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Writer 1' })).toBeDisabled();
  });
});
