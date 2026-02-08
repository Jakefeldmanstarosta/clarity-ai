import { ValidationError, ExternalAPIError } from '../errors/index.js';

export class SpeechController {
  constructor(speechProcessingService, audioValidator, preferencesValidator) {
    this.speechProcessingService = speechProcessingService;
    this.audioValidator = audioValidator;
    this.preferencesValidator = preferencesValidator;
  }

  async transcribe(req, res, next) {
    try {
      this.audioValidator.validate(req.file);

      const originalText = await this.speechProcessingService.transcribe(
        req.file.buffer,
        req.file.mimetype
      );

      res.json({ originalText });
    } catch (error) {
      if (error.message && !error.statusCode) {
        next(new ExternalAPIError(
          `Transcription failed: ${error.message}`,
          'unknown',
          error
        ));
      } else {
        next(error);
      }
    }
  }

  async simplify(req, res, next) {
    try {
      const text = req.body?.text;
      if (!text) {
        throw new ValidationError('Missing text to simplify', 'text');
      }

      const preferences = this.preferencesValidator.validate(req.body?.prefs);
      const simplifiedText = await this.speechProcessingService.simplify(text, preferences);

      res.json({ simplifiedText });
    } catch (error) {
      if (error.message && !error.statusCode) {
        next(new ExternalAPIError(
          `Simplification failed: ${error.message}`,
          'unknown',
          error
        ));
      } else {
        next(error);
      }
    }
  }

  async synthesize(req, res, next) {
    try {
      const text = req.body?.text;
      if (!text) {
        throw new ValidationError('Missing text to synthesize', 'text');
      }

      const speed = this.parseSpeed(req.body?.speed);
      const audioBase64 = await this.speechProcessingService.synthesize(text, { speed });

      res.json({ audioBase64 });
    } catch (error) {
      if (error.message && !error.statusCode) {
        next(new ExternalAPIError(
          `Synthesis failed: ${error.message}`,
          'unknown',
          error
        ));
      } else {
        next(error);
      }
    }
  }

  parseSpeed(speedInput) {
    if (speedInput === undefined || speedInput === null || speedInput === '') {
      return undefined;
    }

    const value = Number(speedInput);
    if (!Number.isFinite(value)) {
      throw new ValidationError('Speech speed must be a number', 'speed');
    }

    if (value < 0.7 || value > 1.2) {
      throw new ValidationError('Speech speed must be between 0.7 and 1.2', 'speed');
    }

    return value;
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
