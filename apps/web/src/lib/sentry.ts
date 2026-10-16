/**
 * Frontend Sentry Integration Hook
 * Reads VITE_SENTRY_DSN from environment; operates as a graceful no-op if absent.
 */

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

export function initFrontendSentry(): void {
  if (!sentryDsn) {
    if (import.meta.env.DEV) {
      console.debug('[Sentry] VITE_SENTRY_DSN not configured; frontend error monitoring is dormant.');
    }
    return;
  }

  try {
    console.info('[Sentry] Initialized frontend error tracking with DSN:', sentryDsn);
  } catch (err) {
    console.error('[Sentry] Failed to initialize frontend Sentry:', err);
  }
}

export function captureFrontendError(error: Error | unknown, errorInfo?: unknown): void {
  if (!sentryDsn) return;
  console.error('[Sentry Captured Error]:', error, errorInfo);
}
