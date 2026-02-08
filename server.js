import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

// Debug: Verify API key is loaded at runtime
console.log("ENV HAS KEY?", Boolean(process.env.ELEVENLABS_API_KEY));
console.log("ENV KEY LENGTH:", process.env.ELEVENLABS_API_KEY?.length);

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { config } from './src/config/index.js';
import { createContainer } from './src/container.js';
import { createRoutes } from './src/routes/index.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import WebSocket from 'ws';

const app = express();
const httpServer = createServer(app);
const container = createContainer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use(createRoutes(container));

// Error handling (must be last)
app.use(errorHandler);

// WebSocket server for realtime transcription
const wss = new WebSocketServer({ server: httpServer, path: '/ws/transcribe' });

wss.on('connection', (ws) => {
  const sessionId = randomUUID();
  console.log(`[WS] New client connected: ${sessionId}`);

  const state = {
    gradiumWs: null,
    ready: false,
    ended: false
  };

  const {
    apiKey,
    wsEndpoint,
    region,
    modelName
  } = config.api.gradium;

  if (!apiKey) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'GRADIUM_API_KEY is not configured'
    }));
    ws.close();
    return;
  }

  const gradiumEndpoint = wsEndpoint || (region === 'us'
    ? 'wss://us.api.gradium.ai/api/speech/asr'
    : 'wss://eu.api.gradium.ai/api/speech/asr');

  const gradiumWs = new WebSocket(gradiumEndpoint, {
    headers: { 'x-api-key': apiKey }
  });

  state.gradiumWs = gradiumWs;

  gradiumWs.on('open', () => {
    gradiumWs.send(JSON.stringify({
      type: 'setup',
      model_name: modelName || 'default',
      input_format: 'pcm'
    }));
  });

  gradiumWs.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (error) {
      console.error(`[WS] ${sessionId} - Invalid Gradium message`, error);
      return;
    }

    if (msg.type === 'ready') {
      state.ready = true;
      ws.send(JSON.stringify({ type: 'ready' }));
      return;
    }

    if (msg.type === 'text' && msg.text) {
      ws.send(JSON.stringify({ type: 'text', text: msg.text }));
      return;
    }

    if (msg.type === 'end_of_stream') {
      state.ended = true;
      ws.send(JSON.stringify({ type: 'end' }));
      return;
    }

    if (msg.type === 'error') {
      ws.send(JSON.stringify({
        type: 'error',
        error: msg.message || 'Gradium error'
      }));
    }
  });

  gradiumWs.on('error', (error) => {
    console.error(`[WS] ${sessionId} - Gradium WS error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      error: `Gradium connection error: ${error.message}`
    }));
  });

  gradiumWs.on('close', () => {
    console.log(`[WS] ${sessionId} - Gradium WS closed`);
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!state.ready || state.ended || !state.gradiumWs) {
        return;
      }

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buffer.length === 0 || buffer.length % 2 !== 0) {
        console.warn(`[WS] ${sessionId} - Ignoring invalid PCM frame length: ${buffer.length}`);
        return;
      }

      if (state.gradiumWs.readyState === WebSocket.OPEN) {
        const base64 = buffer.toString('base64');
        state.gradiumWs.send(JSON.stringify({ type: 'audio', audio: base64 }));
      }
      return;
    }

    const message = data.toString();
    if (message === 'END') {
      state.ended = true;
      if (state.gradiumWs && state.gradiumWs.readyState === WebSocket.OPEN) {
        state.gradiumWs.send(JSON.stringify({ type: 'end_of_stream' }));
      }
    }
  });

  const cleanup = () => {
    if (state.gradiumWs) {
      try {
        state.gradiumWs.close();
      } catch (error) {
        console.error(`[WS] ${sessionId} - Error closing Gradium WS:`, error);
      }
      state.gradiumWs = null;
    }
  };

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${sessionId}`);
    cleanup();
  });

  ws.on('error', (error) => {
    console.error(`[WS] ${sessionId} - WebSocket error:`, error);
    cleanup();
  });
});

// Start server
httpServer.listen(config.server.port, () => {
  console.log(`✨ Clarity-AI server running → http://localhost:${config.server.port}`);
  console.log(`   WebSocket endpoint → ws://localhost:${config.server.port}/ws/transcribe`);
  console.log(`   Environment: ${config.server.nodeEnv}`);
});
