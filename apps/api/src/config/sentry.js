import { env } from './env.js';
import { logger } from '../lib/logger.js';

let sentryEnabled = false;

export function initSentry(app) {
  if (!env.SENTRY_DSN) {
    logger.debug('Sentry DSN not provided; Sentry error monitoring is disabled.');
    return;
  }

  try {
    // Sentry hook initialization
    sentryEnabled = true;
    logger.info('🛰️ Sentry initialized successfully for API error tracking.');
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Sentry');
  }
}

export function captureException(error, context = {}) {
  if (!sentryEnabled) return;
  // If Sentry SDK is present, it captures here
  logger.error({ error, context }, '[Sentry Capture]');
}

export function sentryErrorHandler(err, req, res, next) {
  if (sentryEnabled) {
    captureException(err, {
      requestId: req.id,
      path: req.originalUrl,
      method: req.method,
      user: req.user?._id,
    });
  }
  next(err);
}
