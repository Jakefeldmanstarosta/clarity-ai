export class TextSimplificationService {
  constructor(geminiClient) {
    this.geminiClient = geminiClient;
  }

  async simplify(text, preferences = {}) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text to simplify is empty');
    }

    const prompt = this.buildPrompt(text, preferences);
    return await this.geminiClient.rewrite(prompt);
  }

  buildPrompt(text, preferences) {
    const {
      complexity = 'simple',
      removeJargon = true,
      esl = true
    } = preferences;

    const rules = ['Preserve meaning exactly', 'Output TEXT ONLY (no explanations or meta-commentary)'];

    // Add complexity-based rules
    if (complexity === 'very-simple') {
      rules.push('Use only common words (5th grade reading level)');
      rules.push('Use very short sentences (5-10 words)');
      rules.push('Avoid compound sentences');
    } else if (complexity === 'simple') {
      rules.push('Use simpler vocabulary');
      rules.push('Use short sentences');
    } else if (complexity === 'moderate') {
      rules.push('Use moderate vocabulary');
      rules.push('Balance clarity with natural expression');
    }

    // Add jargon removal rule
    if (removeJargon) {
      rules.push('Remove technical jargon and replace with everyday terms');
      rules.push('Explain any necessary technical terms in simple language');
    }

    // Add ESL-friendly rule
    if (esl) {
      rules.push('ESL-friendly language: avoid idioms, slang, and cultural references');
      rules.push('Use direct, literal language');
      rules.push('Prefer common words over rare synonyms');
    }

    return `You are an accessibility-focused language rewriter.

Rules:
${rules.map(r => `- ${r}`).join('\n')}

Text:
${text}`;
  }
}
