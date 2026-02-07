import { GoogleGenAI } from '@google/genai';
import { SimplificationAPIError, ConfigurationError } from '../errors/index.js';

export class GeminiClient {
  constructor(config) {
    this.config = config;

    const apiKey = config?.api?.gemini?.apiKey;
    if (!apiKey) throw new ConfigurationError('GEMINI_API_KEY is not configured');

    this.ai = new GoogleGenAI({ apiKey });
  }

  async rewrite(prompt) {
    const startTime = Date.now();

    try {
      const { model } = this.config.api.gemini;
      if (!model) throw new ConfigurationError('GEMINI_MODEL is not configured');

      const response = await this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const text = response?.text; // adjust if your SDK uses a different accessor
      if (!text) {
        throw new SimplificationAPIError(
          'Invalid response from Gemini API: missing text in response',
          null,
          { duration: Date.now() - startTime }
        );
      }

      return text;
    } catch (error) {
      if (error instanceof ConfigurationError || error instanceof SimplificationAPIError) throw error;

      throw new SimplificationAPIError(
        `Google Gemini API call failed: ${error?.message || String(error)}`,
        error,
        { duration: Date.now() - startTime, model: this.config?.api?.gemini?.model }
      );
    }
  }
}