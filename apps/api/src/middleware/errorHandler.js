import { logger } from '../lib/logger.js';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path, method: req.method }, err.message || 'Internal error');

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters or request body',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: `Resource ID format is invalid for field ${err.path}`,
      },
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: `A record with this ${field} already exists`,
      },
    });
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const code = err.code && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';

  return res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'An unexpected internal error occurred',
      details: err.details || undefined,
    },
  });
}
