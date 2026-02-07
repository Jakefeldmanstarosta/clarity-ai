import FormData from 'form-data';
import { TranscriptionAPIError, SynthesisAPIError, ConfigurationError } from '../errors/index.js';

export class ElevenLabsClient {
  constructor(config, httpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  async transcribe(audioBuffer, mimeType = 'audio/mpeg') {
    try {
      const { sttEndpoint, apiKey, sttModelId } = this.config.api.elevenlabs;

      if (!apiKey) {
        throw new ConfigurationError('ELEVENLABS_API_KEY is not configured');
      }
      if (!sttModelId) {
        throw new ConfigurationError('ELEVENLABS_STT_MODEL_ID is not configured');
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

      const text =
        response?.text ??
        response?.transcription ??
        response?.data?.text ??
        response?.data?.transcription ??
        (typeof response === 'string' ? response : undefined);

      if (!text) {
        throw new TranscriptionAPIError(
          'Invalid response from ElevenLabs STT API: missing text field',
          null,
          { response }
        );
      }

      return text;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }

      if (error instanceof TranscriptionAPIError) {
        throw error;
      }

      throw new TranscriptionAPIError(
        `ElevenLabs STT API call failed: ${error.message}`,
        error,
        {
          endpoint: this.config.api.elevenlabs.sttEndpoint,
          mimeType
        }
      );
    }
  }

  async synthesize(text) {
    try {
      const { ttsEndpoint, apiKey, voiceId, voiceSettings } = this.config.api.elevenlabs;

      if (!apiKey) {
        throw new ConfigurationError('ELEVENLABS_API_KEY is not configured');
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
