import WebSocket from 'ws';
import { TranscriptionAPIError, ConfigurationError } from '../errors/index.js';

export class GradiumClient {
  constructor(config) {
    this.config = config;
  }

  async transcribe(audioSource, mimeType) {
    const startTime = Date.now();
    console.log('\n=== GRADIUM STT WS START ===');
    console.log(`[Gradium STT] Timestamp: ${new Date().toISOString()}`);

    const {
      apiKey,
      wsEndpoint,
      region,
      modelName,
      inputFormat,
      endTimeoutMs
    } = this.config.api.gradium;

    if (!apiKey) {
      throw new ConfigurationError('GRADIUM_API_KEY is not configured');
    }

    const endpoint = wsEndpoint || this._endpointForRegion(region);
    const resolvedInputFormat = 'pcm';
    this._assertPcmInput(mimeType);

    console.log(`[Gradium STT] Endpoint: ${endpoint}`);
    console.log(`[Gradium STT] Input format: ${resolvedInputFormat}`);
    console.log(`[Gradium STT] API Key present: ${Boolean(apiKey)}`);
    console.log(`[Gradium STT] API Key length: ${apiKey?.length || 0}`);

    const ws = new WebSocket(endpoint, {
      headers: { 'x-api-key': apiKey }
    });

    let transcript = '';
    let ready = false;
    let ended = false;
    let pcmBytesPerFrame = null;

    const readyPromise = this._createDeferred();
    const endPromise = this._createDeferred();

    const cleanupAndThrow = async (error) => {
      try {
        ws.close();
      } catch (closeError) {
        console.error('[Gradium STT] Error closing WebSocket:', closeError);
      }
      throw error;
    };

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (error) {
        if (!readyPromise.settled) {
          readyPromise.reject(new Error(`Gradium STT: invalid JSON (${error.message})`));
        }
        if (!endPromise.settled) {
          endPromise.reject(new Error(`Gradium STT: invalid JSON (${error.message})`));
        }
        return;
      }

      if (msg.type === 'ready') {
        ready = true;
        if (typeof msg.frame_size === 'number') {
          pcmBytesPerFrame = msg.frame_size * 2;
        }
        if (!readyPromise.settled) {
          readyPromise.resolve(msg);
        }
        return;
      }

      if (msg.type === 'text' && msg.text) {
        if (msg.text.startsWith(transcript)) {
          transcript = msg.text;
        } else if (transcript.startsWith(msg.text)) {
          return;
        } else {
          transcript = `${transcript} ${msg.text}`.trim();
        }
        return;
      }

      if (msg.type === 'end_of_stream') {
        ended = true;
        if (!endPromise.settled) {
          endPromise.resolve(msg);
        }
        return;
      }

      if (msg.type === 'error') {
        const message = msg.message || 'Unknown Gradium STT error';
        const code = msg.code ? ` (code ${msg.code})` : '';
        const error = new TranscriptionAPIError(`Gradium STT error: ${message}${code}`);
        if (!readyPromise.settled) {
          readyPromise.reject(error);
        }
        if (!endPromise.settled) {
          endPromise.reject(error);
        }
      }
    });

    ws.on('error', (error) => {
      const wrapped = new TranscriptionAPIError(`Gradium STT socket error: ${error.message}`, error);
      if (!readyPromise.settled) {
        readyPromise.reject(wrapped);
      }
      if (!endPromise.settled) {
        endPromise.reject(wrapped);
      }
    });

    ws.on('close', () => {
      if (!ended && !endPromise.settled) {
        endPromise.reject(new TranscriptionAPIError('Gradium STT socket closed before end_of_stream'));
      }
    });

    try {
      await this._waitForOpen(ws, 10000);

      ws.send(
        JSON.stringify({
          type: 'setup',
          model_name: modelName || 'default',
          input_format: resolvedInputFormat
        })
      );

      await this._withTimeout(readyPromise.promise, 10000, 'Gradium STT: ready timeout');

      for await (const chunk of this._normalizeAudioSource(
        audioSource,
        resolvedInputFormat,
        pcmBytesPerFrame
      )) {
        const base64 = Buffer.from(chunk).toString('base64');
        ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
      }

      ws.send(JSON.stringify({ type: 'end_of_stream' }));

      const endTimeout = Number.isFinite(endTimeoutMs) && endTimeoutMs > 0 ? endTimeoutMs : 120000;
      await this._withTimeout(endPromise.promise, endTimeout, 'Gradium STT: end_of_stream timeout');

      console.log(`[Gradium STT] Transcript length: ${transcript.length}`);
      console.log('=== GRADIUM STT WS END ===\n');

      return transcript.trim();
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n=== GRADIUM STT WS FAILED ===');
      console.error(`[Gradium STT] Error after ${duration}ms:`);
      console.error(`[Gradium STT] Error name: ${error.name}`);
      console.error(`[Gradium STT] Error message: ${error.message}`);
      console.error('=== GRADIUM STT WS END ===\n');

      if (error instanceof ConfigurationError) {
        throw error;
      }

      if (error instanceof TranscriptionAPIError) {
        throw error;
      }

      return await cleanupAndThrow(
        new TranscriptionAPIError(
          `Gradium STT API call failed: ${error.message}`,
          error,
          {
            duration,
            endpoint,
            inputFormat: resolvedInputFormat
          }
        )
      );
    } finally {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  }

  _endpointForRegion(region) {
    return region === 'us'
      ? 'wss://us.api.gradium.ai/api/speech/asr'
      : 'wss://eu.api.gradium.ai/api/speech/asr';
  }

  _assertPcmInput(mimeType) {
    if (!mimeType) {
      throw new TranscriptionAPIError(
        'Missing MIME type. Audio must be 24kHz 16-bit mono PCM (audio/pcm, audio/raw, or application/octet-stream).',
        null,
        { mimeType }
      );
    }

    const normalized = mimeType.toLowerCase();
    if (normalized === 'audio/pcm' || normalized === 'audio/raw' || normalized === 'application/octet-stream') {
      return;
    }

    throw new TranscriptionAPIError(
      `Unsupported audio format ${mimeType}. Audio must be 24kHz 16-bit mono PCM (audio/pcm, audio/raw, or application/octet-stream).`,
      null,
      { mimeType }
    );
  }

  async *_normalizeAudioSource(audioSource, inputFormat, pcmBytesPerFrame) {
    if (!audioSource) {
      throw new TranscriptionAPIError('Audio source is empty');
    }

    const isBuffer = Buffer.isBuffer(audioSource) || audioSource instanceof Uint8Array;
    if (isBuffer) {
      const buffer = Buffer.from(audioSource);
      if (inputFormat === 'wav') {
        yield buffer;
        return;
      }

      const chunkSize = inputFormat === 'pcm'
        ? (pcmBytesPerFrame || 3840)
        : 32768;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        yield buffer.subarray(i, i + chunkSize);
      }
      return;
    }

    if (typeof audioSource[Symbol.asyncIterator] === 'function') {
      if (inputFormat === 'wav') {
        throw new TranscriptionAPIError('WAV streaming not supported; use pcm for streaming');
      }
      for await (const chunk of audioSource) {
        if (!chunk || chunk.length === 0) {
          continue;
        }
        yield chunk;
      }
      return;
    }

    throw new TranscriptionAPIError('Audio source must be a Buffer, Uint8Array, or async iterable');
  }

  _createDeferred() {
    const deferred = {
      settled: false,
      resolve: null,
      reject: null,
      promise: null
    };

    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = (value) => {
        deferred.settled = true;
        resolve(value);
      };
      deferred.reject = (error) => {
        deferred.settled = true;
        reject(error);
      };
    });

    return deferred;
  }

  _withTimeout(promise, timeoutMs, message) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new TranscriptionAPIError(message)), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  _waitForOpen(ws, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new TranscriptionAPIError('Gradium STT: socket open timeout'));
      }, timeoutMs);

      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });

      ws.once('error', (error) => {
        clearTimeout(timer);
        reject(new TranscriptionAPIError(`Gradium STT: socket open error (${error.message})`, error));
      });
    });
  }
}
