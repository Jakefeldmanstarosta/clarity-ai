export class TranscriptionService {
  constructor(elevenLabsClient) {
    this.elevenLabsClient = elevenLabsClient;
  }

  async transcribe(audioBuffer, mimeType) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }

    return await this.elevenLabsClient.transcribe(audioBuffer, mimeType);
  }
}
