export class SpeechProcessingService {
  constructor(transcriptionService, textSimplificationService, speechSynthesisService) {
    this.transcriptionService = transcriptionService;
    this.textSimplificationService = textSimplificationService;
    this.speechSynthesisService = speechSynthesisService;
  }

  async transcribe(audioBuffer, mimeType) {
    return await this.transcriptionService.transcribe(audioBuffer, mimeType);
  }

  async simplify(text, preferences = {}) {
    return await this.textSimplificationService.simplify(text, preferences);
  }

  async synthesize(text, voiceId) {
    return await this.speechSynthesisService.synthesize(text, voiceId);
  }

  async process(audioBuffer, preferences = {}, mimeType) {
    // Step 1: Transcribe audio to text
    const originalText = await this.transcribe(audioBuffer, mimeType);

    // Step 2: Simplify text
    const simplifiedText = await this.simplify(originalText, preferences);

    // Step 3: Convert simplified text back to speech
    const audioBase64 = await this.synthesize(simplifiedText);

    return {
      originalText,
      simplifiedText,
      audioBase64
    };
  }
}
