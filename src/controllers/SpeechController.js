import { ValidationError, ExternalAPIError } from '../errors/index.js';

export class SpeechController {
  constructor(speechProcessingService, audioValidator, preferencesValidator) {
    this.speechProcessingService = speechProcessingService;
    this.audioValidator = audioValidator;
    this.preferencesValidator = preferencesValidator;
  }

  async process(req, res, next) {
    try {
      // Validate audio file
      this.audioValidator.validate(req.file);

      // Validate and parse preferences
      const preferences = this.preferencesValidator.validate(req.body.prefs);

      // Process the audio through the pipeline
      const result = await this.speechProcessingService.process(
        req.file.buffer,
        preferences,
        req.file.mimetype
      );

      // Return successful response
      res.json(result);
    } catch (error) {
      // Wrap external API errors
      if (error.message && !error.statusCode) {
        next(new ExternalAPIError(
          `Processing failed: ${error.message}`,
          'unknown',
          error
        ));
      } else {
        next(error);
      }
    }
  }

  async health(req, res) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'clarity-ai'
    });
  }
}
