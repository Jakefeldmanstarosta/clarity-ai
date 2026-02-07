import { ValidationError } from '../errors/index.js';

export class AudioValidator {
  constructor(config) {
    this.config = config;
  }

  validate(file) {
    if (!file) {
      throw new ValidationError('Missing audio file', 'audio');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new ValidationError('Audio file is empty', 'audio');
    }

    const maxSize = this.config.upload.maxFileSize;
    if (file.size > maxSize) {
      throw new ValidationError(
        `Audio file too large. Maximum size is ${maxSize / 1024 / 1024}MB`,
        'audio'
      );
    }

    const allowedTypes = this.config.upload.allowedMimeTypes;
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      throw new ValidationError(
        `Invalid audio format. Allowed types: ${allowedTypes.join(', ')}`,
        'audio'
      );
    }

    return true;
  }
}
