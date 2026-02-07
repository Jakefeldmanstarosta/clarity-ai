export class GeminiClient {
  constructor(config, httpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  async rewrite(prompt) {
    const { endpoint, apiKey, model } = this.config.api.gemini;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const url = `${endpoint}/${model}:generateContent`;

    const response = await this.httpClient.post(
      url,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        params: { key: apiKey }
      }
    );

    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API: missing text in response');
    }

    return response.candidates[0].content.parts[0].text;
  }
}
