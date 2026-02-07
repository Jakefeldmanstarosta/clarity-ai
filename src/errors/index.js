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
  constructor(message, service = null, originalError = null, details = {}) {
    super(message);
    this.name = 'ExternalAPIError';
    this.statusCode = 502;
    this.code = 'EXTERNAL_API_ERROR';
    this.service = service;
    this.originalError = originalError;
    this.details = details;
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

// Service-specific error classes for better error identification
export class TranscriptionAPIError extends ExternalAPIError {
  constructor(message, originalError = null, details = {}) {
    super(message, 'ElevenLabs STT', originalError, details);
    this.name = 'TranscriptionAPIError';
    this.code = 'TRANSCRIPTION_API_ERROR';
  }
}

export class SimplificationAPIError extends ExternalAPIError {
  constructor(message, originalError = null, details = {}) {
    super(message, 'Google Gemini', originalError, details);
    this.name = 'SimplificationAPIError';
    this.code = 'SIMPLIFICATION_API_ERROR';
  }
}

export class SynthesisAPIError extends ExternalAPIError {
  constructor(message, originalError = null, details = {}) {
    super(message, 'ElevenLabs TTS', originalError, details);
    this.name = 'SynthesisAPIError';
    this.code = 'SYNTHESIS_API_ERROR';
  }
}
