import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
dotenv.config();

// Debug: Verify API key is loaded at runtime
console.log("ENV HAS KEY?", Boolean(process.env.ELEVENLABS_API_KEY));
console.log("ENV KEY LENGTH:", process.env.ELEVENLABS_API_KEY?.length);

import express from 'express';
import cors from 'cors';
import { config } from './src/config/index.js';
import { createContainer } from './src/container.js';
import { createRoutes } from './src/routes/index.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const app = express();
const container = createContainer();

// Middleware
app.use(cors());
app.use(express.static('public'));

// Routes
app.use(createRoutes(container));

// Error handling (must be last)
app.use(errorHandler);

// Start server
app.listen(config.server.port, () => {
  console.log(`✨ Clarity-AI server running → http://localhost:${config.server.port}`);
  console.log(`   Environment: ${config.server.nodeEnv}`);
});
