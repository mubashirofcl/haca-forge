import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../LoginPage';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

// The demo quick-fill panel shipped real seed credentials (including the admin's) in the
// client bundle. It was removed; these tests keep it from coming back.
describe('LoginPage credentials', () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('has no demo quick-fill accounts panel', () => {
    renderPage();
    expect(screen.queryByText(/demo quick-fill/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /shooter \(worker\)|editor \(worker\)|creative head|admin/i })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/@demo\.haca\.local/);
  });

  it('starts with empty email and password fields', () => {
    renderPage();
    const emailInput = screen.getByPlaceholderText('name@company.com') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
  });
});
