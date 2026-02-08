import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowInsecureHttps: (process.env.ALLOW_INSECURE_HTTPS || '').toLowerCase() === 'true'
  },
  api: {
    gradium: {
      apiKey: process.env.GRADIUM_API_KEY,
      region: process.env.GRADIUM_REGION || 'eu',
      wsEndpoint: process.env.GRADIUM_WS_ENDPOINT,
      modelName: process.env.GRADIUM_STT_MODEL || 'default',
      inputFormat: 'pcm',
      endTimeoutMs: Number.parseInt(process.env.GRADIUM_STT_END_TIMEOUT_MS || '120000', 10)
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL
    },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    ttsEndpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    
    // NEW: You MUST add this for 'speed' to work
    modelId: 'eleven_turbo_v2_5', 
    
    voiceSettings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
}
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['audio/pcm', 'audio/raw', 'application/octet-stream']
  }
};
