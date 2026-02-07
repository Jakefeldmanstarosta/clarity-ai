import FormData from 'form-data';

export class ElevenLabsClient {
  constructor(config, httpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  async transcribe(audioBuffer, mimeType = 'audio/mpeg') {
    const { sttEndpoint, apiKey, sttModelId } = this.config.api.elevenlabs;

    console.log('[DEBUG] ElevenLabs transcribe() called');
    console.log('[DEBUG] config.api.elevenlabs:', this.config.api.elevenlabs);
    console.log('[DEBUG] apiKey exists?', Boolean(apiKey));
    console.log('[DEBUG] apiKey length:', apiKey?.length);

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    if (!sttModelId) {
      throw new Error('ELEVENLABS_STT_MODEL_ID is not configured');
    }

    const form = new FormData();
    form.append('model_id', sttModelId);
    form.append('file', audioBuffer, {
      filename: 'audio',
      contentType: mimeType
    });

    const response = await this.httpClient.post(sttEndpoint, form, {
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders()
      }
    });

    if (!response.text) {
      throw new Error('Invalid response from ElevenLabs STT API: missing text field');
    }

    return response.text;
  }

  async synthesize(text) {
    const { ttsEndpoint, apiKey, voiceId, voiceSettings } = this.config.api.elevenlabs;

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const url = `${ttsEndpoint}/${voiceId}`;

    const response = await this.httpClient.axiosInstance.post(
      url,
      {
        text,
        voice_settings: voiceSettings
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert arraybuffer to base64
    return Buffer.from(response.data).toString('base64');
  }
}
