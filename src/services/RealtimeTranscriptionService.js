import WebSocket from 'ws';
import { TranscriptionAPIError, ConfigurationError } from '../errors/index.js';

export class RealtimeTranscriptionService {
  constructor(config) {
    this.config = config;
    this.activeSessions = new Map(); // sessionId -> { gradiumWs, clientWs, transcript }
  }

  async startSession(clientWs, sessionId) {
    console.log(`\n[RT STT] Starting session ${sessionId}`);

    const {
      apiKey,
      wsEndpoint,
      region,
      modelName
    } = this.config.api.gradium;

    if (!apiKey) {
      throw new ConfigurationError('GRADIUM_API_KEY is not configured');
    }

    const endpoint = wsEndpoint || this._endpointForRegion(region);
    console.log(`[RT STT] Connecting to ${endpoint}`);

    const gradiumWs = new WebSocket(endpoint, {
      headers: { 'x-api-key': apiKey }
    });

    const session = {
      gradiumWs,
      clientWs,
      transcript: '',
      ready: false
    };

    this.activeSessions.set(sessionId, session);

    // Handle Gradium WebSocket events
    gradiumWs.on('open', () => {
      console.log(`[RT STT] ${sessionId} - Gradium WS connected`);

      // Send setup message
      gradiumWs.send(JSON.stringify({
        type: 'setup',
        model_name: modelName || 'default',
        input_format: 'opus'
      }));
    });

    gradiumWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ready') {
          session.ready = true;
          console.log(`[RT STT] ${sessionId} - Ready to receive audio`);
          clientWs.send(JSON.stringify({ type: 'ready' }));
          return;
        }

        if (msg.type === 'text' && msg.text) {
          // Update cumulative transcript
          if (msg.text.startsWith(session.transcript)) {
            session.transcript = msg.text;
          } else if (session.transcript.startsWith(msg.text)) {
            return; // Ignore redundant partial
          } else {
            session.transcript = `${session.transcript} ${msg.text}`.trim();
          }

          console.log(`[RT STT] ${sessionId} - Text: "${msg.text.substring(0, 50)}..."`);

          // Stream result back to client immediately
          clientWs.send(JSON.stringify({
            type: 'text',
            text: session.transcript,
            partial: msg.text
          }));
          return;
        }

        if (msg.type === 'end_of_stream') {
          console.log(`[RT STT] ${sessionId} - Stream ended`);
          clientWs.send(JSON.stringify({
            type: 'end',
            finalTranscript: session.transcript
          }));
          return;
        }

        if (msg.type === 'error') {
          const errorMsg = msg.message || 'Unknown Gradium error';
          console.error(`[RT STT] ${sessionId} - Gradium error: ${errorMsg}`);
          clientWs.send(JSON.stringify({
            type: 'error',
            error: errorMsg
          }));
        }
      } catch (error) {
        console.error(`[RT STT] ${sessionId} - Error parsing message:`, error);
      }
    });

    gradiumWs.on('error', (error) => {
      console.error(`[RT STT] ${sessionId} - Gradium WS error:`, error.message);
      clientWs.send(JSON.stringify({
        type: 'error',
        error: `Gradium connection error: ${error.message}`
      }));
    });

    gradiumWs.on('close', () => {
      console.log(`[RT STT] ${sessionId} - Gradium WS closed`);
      this.activeSessions.delete(sessionId);
    });

    // Wait for ready state
    await this._waitForReady(session, 10000);
  }

  sendAudioChunk(sessionId, audioBuffer) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.ready) {
      throw new Error(`Session ${sessionId} not ready`);
    }

    const gradiumWs = session.gradiumWs;

    // Check backpressure
    if (gradiumWs.bufferedAmount > 1024 * 1024) { // 1MB threshold
      console.warn(`[RT STT] ${sessionId} - High buffer amount: ${gradiumWs.bufferedAmount} bytes`);
      // Could implement throttling here if needed
    }

    // Convert to base64 and send
    const base64 = Buffer.from(audioBuffer).toString('base64');
    gradiumWs.send(JSON.stringify({
      type: 'audio',
      audio: base64
    }));
  }

  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      console.warn(`[RT STT] ${sessionId} - Session not found for end`);
      return;
    }

    console.log(`[RT STT] ${sessionId} - Ending session`);

    const gradiumWs = session.gradiumWs;

    if (gradiumWs.readyState === WebSocket.OPEN) {
      gradiumWs.send(JSON.stringify({ type: 'end_of_stream' }));

      // Close after a short delay to allow end_of_stream processing
      setTimeout(() => {
        if (gradiumWs.readyState === WebSocket.OPEN) {
          gradiumWs.close();
        }
        this.activeSessions.delete(sessionId);
      }, 1000);
    } else {
      this.activeSessions.delete(sessionId);
    }
  }

  _endpointForRegion(region) {
    return region === 'us'
      ? 'wss://us.api.gradium.ai/api/speech/asr'
      : 'wss://eu.api.gradium.ai/api/speech/asr';
  }

  _waitForReady(session, timeoutMs) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkReady = () => {
        if (session.ready) {
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new TranscriptionAPIError('Gradium ready timeout'));
          return;
        }

        setTimeout(checkReady, 100);
      };

      checkReady();
    });
  }
}
