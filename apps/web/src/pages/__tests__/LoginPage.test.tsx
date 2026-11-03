import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('LoginPage Quick-Fill Accounts', () => {
  it('renders Shooter and Editor in Demo Quick-Fill Accounts and fills form on click', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify shooter and editor buttons exist
    const shooterBtn = screen.getByRole('button', { name: /shooter \(worker\)/i });
    const editorBtn = screen.getByRole('button', { name: /editor \(worker\)/i });
    expect(shooterBtn).toBeInTheDocument();
    expect(editorBtn).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('name@company.com') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;

    // Click Shooter
    fireEvent.click(shooterBtn);
    expect(emailInput.value).toBe('shooter@demo.haca.local');
    expect(passwordInput.value).toBe('Shoot1@Test115');

    // Click Editor
    fireEvent.click(editorBtn);
    expect(emailInput.value).toBe('editor1@demo.haca.local');
    expect(passwordInput.value).toBe('Edit1@Test116');
  });
});
