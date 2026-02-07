import { config } from './config/index.js';
import { BaseHttpClient } from './clients/BaseHttpClient.js';
import { GeminiClient } from './clients/GeminiClient.js';
import { ElevenLabsClient } from './clients/ElevenLabsClient.js';
import { TranscriptionService } from './services/TranscriptionService.js';
import { TextSimplificationService } from './services/TextSimplificationService.js';
import { SpeechSynthesisService } from './services/SpeechSynthesisService.js';
import { SpeechProcessingService } from './services/SpeechProcessingService.js';
import { SpeechController } from './controllers/SpeechController.js';
import { AudioValidator } from './validators/AudioValidator.js';
import { PreferencesValidator } from './validators/PreferencesValidator.js';

export function createContainer() {
  // Create HTTP client
  const httpClient = new BaseHttpClient(config);

  // Create API clients
  const geminiClient = new GeminiClient(config);
  const elevenLabsClient = new ElevenLabsClient(config, httpClient);

  // Create services (ElevenLabs handles both STT and TTS)
  const transcriptionService = new TranscriptionService(elevenLabsClient);
  const textSimplificationService = new TextSimplificationService(geminiClient);
  const speechSynthesisService = new SpeechSynthesisService(elevenLabsClient);
  const speechProcessingService = new SpeechProcessingService(
    transcriptionService,
    textSimplificationService,
    speechSynthesisService
  );

  // Create validators
  const audioValidator = new AudioValidator(config);
  const preferencesValidator = new PreferencesValidator();

  // Create controllers
  const speechController = new SpeechController(
    speechProcessingService,
    audioValidator,
    preferencesValidator
  );

  return {
    controllers: {
      speechController
    }
  };
}
