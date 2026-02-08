export class SpeechSynthesisService {
  constructor(elevenLabsClient) {
    this.elevenLabsClient = elevenLabsClient;
  }

  async synthesize(text, voiceId) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text to synthesize is empty');
    }

    return await this.elevenLabsClient.synthesize(text, voiceId);
  }
}
