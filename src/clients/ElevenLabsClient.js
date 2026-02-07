import FormData from 'form-data';
import { TranscriptionAPIError, SynthesisAPIError, ConfigurationError } from '../errors/index.js';

export class ElevenLabsClient {
  constructor(config, httpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  async transcribe(audioBuffer, mimeType = 'audio/mpeg') {
    const startTime = Date.now();
    console.log('\n=== ELEVENLABS STT API CALL START ===');
    console.log(`[ElevenLabs STT] Timestamp: ${new Date().toISOString()}`);
    console.log(`[ElevenLabs STT] Audio buffer size: ${audioBuffer.length} bytes`);
    console.log(`[ElevenLabs STT] MIME type: ${mimeType}`);

    try {
      const { sttEndpoint, apiKey, sttModelId } = this.config.api.elevenlabs;

      console.log(`[ElevenLabs STT] Endpoint: ${sttEndpoint}`);
      console.log(`[ElevenLabs STT] Model ID: ${sttModelId}`);
      console.log(`[ElevenLabs STT] API Key present: ${Boolean(apiKey)}`);
      console.log(`[ElevenLabs STT] API Key length: ${apiKey?.length || 0}`);

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

      console.log(`[ElevenLabs STT] Making API request...`);

      const response = await this.httpClient.post(sttEndpoint, form, {
        headers: {
          'xi-api-key': apiKey,
          ...form.getHeaders()
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[ElevenLabs STT] Request completed in ${duration}ms`);
      console.log(`[ElevenLabs STT] Response structure:`, Object.keys(response || {}));

      const text =
        response?.text ??
        response?.transcription ??
        response?.data?.text ??
        response?.data?.transcription ??
        (typeof response === 'string' ? response : undefined);

      if (!text) {
        console.error('[ElevenLabs STT] ERROR: No text found in response:', response);
        throw new TranscriptionAPIError(
          'Invalid response from ElevenLabs STT API: missing text field',
          null,
          { response, duration }
        );
      }

      console.log(`[ElevenLabs STT] Success! Transcribed text length: ${text.length} characters`);
      console.log(`[ElevenLabs STT] Transcribed text preview: "${text.substring(0, 100)}..."`);
      console.log('=== ELEVENLABS STT API CALL END ===\n');

      return text;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n=== ELEVENLABS STT API CALL FAILED ===');
      console.error(`[ElevenLabs STT] Error after ${duration}ms:`);
      console.error(`[ElevenLabs STT] Error name: ${error.name}`);
      console.error(`[ElevenLabs STT] Error message: ${error.message}`);
      console.error(`[ElevenLabs STT] Error stack:`, error.stack);
      console.error('=== ELEVENLABS STT API CALL END ===\n');

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
          duration,
          endpoint: this.config.api.elevenlabs.sttEndpoint,
          mimeType
        }
      );
    }
  }

  async synthesize(text) {
    const startTime = Date.now();
    console.log('\n=== ELEVENLABS TTS API CALL START ===');
    console.log(`[ElevenLabs TTS] Timestamp: ${new Date().toISOString()}`);
    console.log(`[ElevenLabs TTS] Text to synthesize: "${text.substring(0, 100)}..."`);
    console.log(`[ElevenLabs TTS] Text length: ${text.length} characters`);

    try {
      const { ttsEndpoint, apiKey, voiceId, voiceSettings } = this.config.api.elevenlabs;

      console.log(`[ElevenLabs TTS] Endpoint: ${ttsEndpoint}`);
      console.log(`[ElevenLabs TTS] Voice ID: ${voiceId}`);
      console.log(`[ElevenLabs TTS] API Key present: ${Boolean(apiKey)}`);
      console.log(`[ElevenLabs TTS] Voice settings:`, voiceSettings);

      if (!apiKey) {
        throw new ConfigurationError('ELEVENLABS_API_KEY is not configured');
      }

      const url = `${ttsEndpoint}/${voiceId}`;
      console.log(`[ElevenLabs TTS] Full URL: ${url}`);
      console.log(`[ElevenLabs TTS] Making API request...`);

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

      const duration = Date.now() - startTime;
      const audioSize = response.data.length;
      console.log(`[ElevenLabs TTS] Request completed in ${duration}ms`);
      console.log(`[ElevenLabs TTS] Audio size: ${audioSize} bytes`);

      const base64Audio = Buffer.from(response.data).toString('base64');
      console.log(`[ElevenLabs TTS] Success! Base64 audio length: ${base64Audio.length} characters`);
      console.log('=== ELEVENLABS TTS API CALL END ===\n');

      return base64Audio;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n=== ELEVENLABS TTS API CALL FAILED ===');
      console.error(`[ElevenLabs TTS] Error after ${duration}ms:`);
      console.error(`[ElevenLabs TTS] Error name: ${error.name}`);
      console.error(`[ElevenLabs TTS] Error message: ${error.message}`);
      console.error(`[ElevenLabs TTS] Error stack:`, error.stack);
      console.error('=== ELEVENLABS TTS API CALL END ===\n');

      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new SynthesisAPIError(
        `ElevenLabs TTS API call failed: ${error.message}`,
        error,
        {
          duration,
          endpoint: this.config.api.elevenlabs.ttsEndpoint,
          voiceId: this.config.api.elevenlabs.voiceId,
          textLength: text.length
        }
      );
    }
  }
}
