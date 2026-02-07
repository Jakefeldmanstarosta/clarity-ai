export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.field = field;
  }
}

export class ExternalAPIError extends Error {
  constructor(message, service = null, originalError = null) {
    super(message);
    this.name = 'ExternalAPIError';
    this.statusCode = 502;
    this.code = 'EXTERNAL_API_ERROR';
    this.service = service;
    this.originalError = originalError;
  }
}

export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
    this.statusCode = 500;
    this.code = 'CONFIGURATION_ERROR';
  }
}
