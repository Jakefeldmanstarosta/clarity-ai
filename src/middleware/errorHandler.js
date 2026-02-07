import {
  ValidationError,
  ExternalAPIError,
  ConfigurationError,
  TranscriptionAPIError,
  SimplificationAPIError,
  SynthesisAPIError
} from '../errors/index.js';

export function errorHandler(err, req, res, next) {
  // Build detailed error log
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode
    }
  };

  // Add service-specific information
  if (err.service) {
    errorLog.error.service = err.service;
  }

  if (err.details) {
    errorLog.error.details = err.details;
  }

  if (err.field) {
    errorLog.error.field = err.field;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorLog.error.stack = err.stack;
  }

  // Log with appropriate level
  if (err instanceof ValidationError) {
    console.warn('⚠️  VALIDATION ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err instanceof TranscriptionAPIError) {
    console.error('❌ TRANSCRIPTION API ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err instanceof SimplificationAPIError) {
    console.error('❌ SIMPLIFICATION API ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err instanceof SynthesisAPIError) {
    console.error('❌ SYNTHESIS API ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err instanceof ConfigurationError) {
    console.error('❌ CONFIGURATION ERROR:', JSON.stringify(errorLog, null, 2));
  } else if (err instanceof ExternalAPIError) {
    console.error('❌ EXTERNAL API ERROR:', JSON.stringify(errorLog, null, 2));
  } else {
    console.error('❌ UNEXPECTED ERROR:', JSON.stringify(errorLog, null, 2));
  }

  // Handle known error types
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      field: err.field,
      statusCode: err.statusCode
    });
  }

  if (err instanceof TranscriptionAPIError ||
      err instanceof SimplificationAPIError ||
      err instanceof SynthesisAPIError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      service: err.service,
      statusCode: err.statusCode,
      details: process.env.NODE_ENV === 'development' ? err.details : undefined
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
