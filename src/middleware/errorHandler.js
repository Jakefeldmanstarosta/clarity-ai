import { ValidationError, ExternalAPIError, ConfigurationError } from '../errors/index.js';

export function errorHandler(err, req, res, next) {
  // Log error with context
  console.error('Error processing request:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });

  // Handle known error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      field: err.field,
      statusCode: err.statusCode
    });
  }

  if (err instanceof ExternalAPIError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      service: err.service,
      statusCode: err.statusCode
    });
  }

  if (err instanceof ConfigurationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      statusCode: err.statusCode
    });
  }

  // Handle unknown errors
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    error: message,
    code: 'INTERNAL_SERVER_ERROR',
    statusCode
  });
}
