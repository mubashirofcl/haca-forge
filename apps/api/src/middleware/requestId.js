import crypto from 'crypto';

/**
 * Middleware that assigns a unique Correlation ID (X-Request-Id) to each incoming request.
 * Useful for distributed tracing, log aggregation, and debugging.
 */
export function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId = existingId && typeof existingId === 'string' && existingId.trim().length > 0
    ? existingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
