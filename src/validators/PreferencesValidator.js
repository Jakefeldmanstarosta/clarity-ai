import { ValidationError } from '../errors/index.js';

export class PreferencesValidator {
  static DEFAULT_PREFERENCES = {
    complexity: 'simple',
    removeJargon: true,
    esl: true
  };

  static VALID_COMPLEXITY_VALUES = ['very-simple', 'simple', 'moderate'];

  validate(prefsInput) {
    // If no preferences provided, return defaults
    if (!prefsInput) {
      return { ...PreferencesValidator.DEFAULT_PREFERENCES };
    }

    let prefs;

    // Parse if string
    if (typeof prefsInput === 'string') {
      try {
        prefs = JSON.parse(prefsInput);
      } catch (error) {
        throw new ValidationError('Invalid JSON format for preferences', 'prefs');
      }
    } else if (typeof prefsInput === 'object') {
      prefs = prefsInput;
    } else {
      throw new ValidationError('Preferences must be an object or JSON string', 'prefs');
    }

    // Validate and set defaults
    const validated = {
      complexity: prefs.complexity || PreferencesValidator.DEFAULT_PREFERENCES.complexity,
      removeJargon: prefs.removeJargon !== undefined
        ? Boolean(prefs.removeJargon)
        : PreferencesValidator.DEFAULT_PREFERENCES.removeJargon,
      esl: prefs.esl !== undefined
        ? Boolean(prefs.esl)
        : PreferencesValidator.DEFAULT_PREFERENCES.esl
    };

    // Validate complexity value
    if (!PreferencesValidator.VALID_COMPLEXITY_VALUES.includes(validated.complexity)) {
      throw new ValidationError(
        `Invalid complexity value. Must be one of: ${PreferencesValidator.VALID_COMPLEXITY_VALUES.join(', ')}`,
        'prefs.complexity'
      );
    }

    return validated;
  }
}
