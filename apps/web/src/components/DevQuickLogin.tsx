import React from 'react';

export interface QuickLoginAccount {
  label: string;
  email: string;
  password: string;
  /** Optional (Phase 9): groups the buttons by role. */
  role?: string;
}

/** Reads the base64 JSON list from VITE_QUICK_LOGINS (apps/web/.env.local). A bad value gives no buttons. */
export function parseQuickLogins(raw: unknown): QuickLoginAccount[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const list = JSON.parse(atob(raw.trim()));
    if (!Array.isArray(list)) return [];
    return list.filter((a) => a && typeof a.label === 'string' && typeof a.email === 'string' && typeof a.password === 'string');
  } catch {
    return [];
  }
}

/** Role groups in a fixed order; accounts without a known role go under "Other". */
export const QUICK_LOGIN_GROUPS: { role: string; title: string }[] = [
  { role: 'admin', title: 'Admin' },
  { role: 'creative_head', title: 'Creative Head' },
  { role: 'sm_manager', title: 'SM Manager' },
  { role: 'executive', title: 'Executive' },
  { role: 'team_member', title: 'Team members' },
];

export function groupQuickLogins(accounts: QuickLoginAccount[]): { title: string; accounts: QuickLoginAccount[] }[] {
  const known = new Set(QUICK_LOGIN_GROUPS.map((g) => g.role));
  const groups = QUICK_LOGIN_GROUPS.map((g) => ({ title: g.title, accounts: accounts.filter((a) => a.role === g.role) }));
  const other = accounts.filter((a) => !a.role || !known.has(a.role));
  return [...groups, { title: 'Other', accounts: other }].filter((g) => g.accounts.length > 0);
}

interface DevQuickLoginProps {
  accounts: QuickLoginAccount[];
  busy?: boolean;
  onPick: (account: QuickLoginAccount) => void;
}

/** Local development only. LoginPage passes no accounts outside the Vite dev server. */
export const DevQuickLogin: React.FC<DevQuickLoginProps> = ({ accounts, busy, onPick }) => {
  if (accounts.length === 0) return null;
  return (
    <section
      aria-label="Quick sign in"
      className="glass-modal border border-white p-4 mt-4 w-full lg:mt-0 lg:fixed lg:z-20 lg:right-6 lg:top-1/2 lg:-translate-y-1/2 lg:w-60 lg:max-h-[90vh] lg:overflow-y-auto"
    >
      <h3 className="text-xs font-bold text-ui-ink">Quick sign in</h3>
      <p className="text-[11px] text-ui-muted mt-0.5 mb-3">Local development only</p>
      <div className="space-y-3">
        {groupQuickLogins(accounts).map((group) => (
          <div key={group.title} role="group" aria-label={group.title} data-testid="quick-login-group">
            <h4 className="text-[11px] font-semibold text-ui-muted mb-1">{group.title}</h4>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {group.accounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={busy}
                  title={account.email}
                  onClick={() => onPick(account)}
                  className="min-h-[36px] px-3 py-1.5 text-left text-xs font-semibold text-ui-ink bg-white hover:bg-ui-canvas border border-ui-line rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
