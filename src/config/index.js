import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowInsecureHttps: (process.env.ALLOW_INSECURE_HTTPS || '').toLowerCase() === 'true'
  },
  api: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY,
      sttEndpoint: 'https://api.elevenlabs.io/v1/speech-to-text',
      ttsEndpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
      sttModelId: process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v2',
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm']
  }
};
