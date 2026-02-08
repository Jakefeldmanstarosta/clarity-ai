import { SynthesisAPIError, ConfigurationError } from '../errors/index.js';

export class ElevenLabsClient {
  constructor(config, httpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  async synthesize(text, options = {}) {
    try {
      const { ttsEndpoint, apiKey, voiceId, voiceSettings } = this.config.api.elevenlabs;

      if (!apiKey) {
        throw new ConfigurationError('ELEVENLABS_API_KEY is not configured');
      }

      const speed = Number.isFinite(options?.speed) ? options.speed : undefined;
      const mergedVoiceSettings = speed !== undefined
        ? { ...voiceSettings, speed }
        : { ...voiceSettings };

      const url = `${ttsEndpoint}/${voiceId}`;
      const response = await this.httpClient.axiosInstance.post(
        url,
        {
          text,
          voice_settings: mergedVoiceSettings
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      const base64Audio = Buffer.from(response.data).toString('base64');
      return base64Audio;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new SynthesisAPIError(
        `ElevenLabs TTS API call failed: ${error.message}`,
        error,
        {
          endpoint: this.config.api.elevenlabs.ttsEndpoint,
          voiceId: this.config.api.elevenlabs.voiceId,
          textLength: text.length
        }
      );
    }
  }
}
