export class TranscriptionService {
  constructor(gradiumClient) {
    this.gradiumClient = gradiumClient;
  }

  async transcribe(audioBuffer, mimeType) {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }

    return await this.gradiumClient.transcribe(audioBuffer, mimeType);
  }
}
