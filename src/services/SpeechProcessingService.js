export class SpeechProcessingService {
  constructor(transcriptionService, textSimplificationService, speechSynthesisService) {
    this.transcriptionService = transcriptionService;
    this.textSimplificationService = textSimplificationService;
    this.speechSynthesisService = speechSynthesisService;
  }

  async process(audioBuffer, preferences = {}, mimeType) {
    // Step 1: Transcribe audio to text
    const originalText = await this.transcriptionService.transcribe(audioBuffer, mimeType);

    // Step 2: Temporarily skip Gemini; keep wiring for easy re-enable
    const simplifiedText = await this.textSimplificationService.simplify(originalText, preferences);

    // Step 3: Convert simplified text back to speech
    const audioBase64 = await this.speechSynthesisService.synthesize(simplifiedText);

    return {
      originalText,
      simplifiedText,
      audioBase64
    };
  }
}
