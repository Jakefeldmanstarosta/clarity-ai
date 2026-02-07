# Clarity-AI Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Browser)                       │
│                                                                  │
│  ┌──────────────┐  ┌─────────────────────────────────────┐    │
│  │              │  │  SpeechSimplifierApp Class          │    │
│  │  index.html  │──│  - Recording control                │    │
│  │              │  │  - Preferences UI                   │    │
│  │  + Prefs UI  │  │  - Status indicators                │    │
│  │  + Status    │  │  - Error handling                   │    │
│  └──────────────┘  └─────────────────────────────────────┘    │
│                                     │                            │
│                                     │ POST /process              │
│                                     │ { audio, prefs }           │
└─────────────────────────────────────┼────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    server.js (28 lines)                   │  │
│  │  - Bootstrap application                                  │  │
│  │  - Load configuration                                     │  │
│  │  - Create dependency container                            │  │
│  │  - Mount routes + error handler                           │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────┼─────────────────────────────────┐  │
│  │     ROUTING LAYER      │                                 │  │
│  │  ┌─────────────────────▼──────────────────────────────┐ │  │
│  │  │ routes/index.js                                     │ │  │
│  │  │  - POST /process → SpeechController.process()      │ │  │
│  │  │  - GET  /health  → SpeechController.health()       │ │  │
│  │  └─────────────────────┬──────────────────────────────┘ │  │
│  └────────────────────────┼─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────┼─────────────────────────────────┐  │
│  │   CONTROLLER LAYER     │                                 │  │
│  │  ┌─────────────────────▼──────────────────────────────┐ │  │
│  │  │ SpeechController                                    │ │  │
│  │  │  - Validate audio file (AudioValidator)            │ │  │
│  │  │  - Validate preferences (PreferencesValidator)     │ │  │
│  │  │  - Call SpeechProcessingService                    │ │  │
│  │  │  - Handle errors → ErrorHandler                    │ │  │
│  │  └─────────────────────┬──────────────────────────────┘ │  │
│  └────────────────────────┼─────────────────────────────────┘  │
│                           │                                     │
│  ┌────────────────────────┼─────────────────────────────────┐  │
│  │    SERVICE LAYER       │                                 │  │
│  │  ┌─────────────────────▼──────────────────────────────┐ │  │
│  │  │ SpeechProcessingService (Orchestrator)             │ │  │
│  │  │  Step 1 ─────────────────────────────────────────┐ │ │  │
│  │  │  │ TranscriptionService.transcribe()            │ │ │  │
│  │  │  │  - Validate audio buffer                      │ │ │  │
│  │  │  │  - Call GradiumClient                         │ │ │  │
│  │  │  └──────────────────────────────────────────────┘ │ │  │
│  │  │                                                    │ │  │
│  │  │  Step 2 ─────────────────────────────────────────┐ │ │  │
│  │  │  │ TextSimplificationService.simplify()         │ │ │  │
│  │  │  │  - Build prompt with preferences ⭐          │ │ │  │
│  │  │  │    • complexity (very-simple/simple/moderate)│ │ │  │
│  │  │  │    • removeJargon (true/false)               │ │ │  │
│  │  │  │    • esl (true/false)                        │ │ │  │
│  │  │  │  - Call GeminiClient                          │ │ │  │
│  │  │  └──────────────────────────────────────────────┘ │ │  │
│  │  │                                                    │ │  │
│  │  │  Step 3 ─────────────────────────────────────────┐ │ │  │
│  │  │  │ SpeechSynthesisService.synthesize()          │ │ │  │
│  │  │  │  - Validate text                              │ │ │  │
│  │  │  │  - Call ElevenLabsClient                      │ │ │  │
│  │  │  └──────────────────────────────────────────────┘ │ │  │
│  │  │                                                    │ │  │
│  │  │  Return: { originalText, simplifiedText, audio } │ │  │
│  │  └────────────────────────┬───────────────────────────┘ │  │
│  └───────────────────────────┼─────────────────────────────┘  │
│                              │                                 │
│  ┌───────────────────────────┼─────────────────────────────┐  │
│  │    CLIENT LAYER           │                             │  │
│  │                           │                             │  │
│  │  ┌────────────────────────▼──────────┐                 │  │
│  │  │ BaseHttpClient                    │                 │  │
│  │  │  - Axios wrapper                  │                 │  │
│  │  │  - HTTPS agent config             │                 │  │
│  │  │  - Error handling                 │                 │  │
│  │  │  - Timeout management (30s)       │                 │  │
│  │  └────────────┬──────────────────────┘                 │  │
│  │               │                                         │  │
│  │       ┌───────┼──────────┬──────────────────────┐      │  │
│  │       │       │          │                      │      │  │
│  │  ┌────▼─────┐ │  ┌───────▼────────┐  ┌─────────▼───┐ │  │
│  │  │ Gradium  │ │  │ Gemini         │  │ ElevenLabs  │ │  │
│  │  │ Client   │ │  │ Client         │  │ Client      │ │  │
│  │  │          │ │  │                │  │             │ │  │
│  │  │ .trans-  │ │  │ .rewrite()     │  │ .synthe-    │ │  │
│  │  │  cribe() │ │  │                │  │  size()     │ │  │
│  │  └────┬─────┘ │  └───────┬────────┘  └─────────┬───┘ │  │
│  └───────┼───────┼──────────┼──────────────────────┼─────┘  │
│          │       │          │                      │         │
└──────────┼───────┼──────────┼──────────────────────┼─────────┘
           │       │          │                      │
           │       │          │                      │
           ▼       ▼          ▼                      ▼
     ┌──────────┐ ┌────────────────┐ ┌────────────────────┐
     │ Gradium  │ │ Google Gemini  │ │ ElevenLabs TTS API │
     │ STT API  │ │ API            │ │                    │
     └──────────┘ └────────────────┘ └────────────────────┘
```

---

## Request Flow

### 1. User Records Audio

```
User clicks "Start Recording"
    ↓
SpeechSimplifierApp.startRecording()
    ↓
navigator.mediaDevices.getUserMedia({ audio: true })
    ↓
MediaRecorder starts capturing
    ↓
User clicks "Stop Recording"
    ↓
SpeechSimplifierApp.stopRecording()
```

### 2. Audio Processing Request

```
FormData created with:
  - audio: Blob (audio/wav)
  - prefs: JSON string { complexity, removeJargon, esl }
    ↓
POST /process
    ↓
routes/index.js → multer middleware
    ↓
SpeechController.process(req, res, next)
```

### 3. Validation Phase

```
AudioValidator.validate(req.file)
  ✓ File exists
  ✓ File not empty
  ✓ Size < 10MB
  ✓ Valid mime type
    ↓
PreferencesValidator.validate(req.body.prefs)
  ✓ Parse JSON string
  ✓ Validate complexity value
  ✓ Apply defaults for missing fields
    ↓
Valid preferences returned:
  { complexity: 'simple', removeJargon: true, esl: true }
```

### 4. Service Pipeline Execution

```
SpeechProcessingService.process(audioBuffer, preferences)
    ↓
┌─────────────────────────────────────────────────────┐
│ STEP 1: Transcription                               │
│ TranscriptionService.transcribe(audioBuffer)        │
│     ↓                                               │
│ GradiumClient.transcribe(audioBuffer)               │
│     ↓                                               │
│ BaseHttpClient.post(                                │
│   'https://api.gradium.ai/v1/speech-to-text',      │
│   audioBuffer,                                      │
│   { headers: { Authorization: 'Bearer ...' } }     │
│ )                                                   │
│     ↓                                               │
│ Result: "The mitochondria is the powerhouse..."    │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ STEP 2: Text Simplification ⭐ (Uses Preferences)  │
│ TextSimplificationService.simplify(text, prefs)    │
│     ↓                                               │
│ buildPrompt(text, preferences)                     │
│   - complexity: 'simple'                            │
│   - removeJargon: true                              │
│   - esl: true                                       │
│     ↓                                               │
│ Generated prompt:                                   │
│   "You are an accessibility-focused rewriter.      │
│    Rules:                                           │
│    - Preserve meaning exactly                       │
│    - Use simpler vocabulary                         │
│    - Use short sentences                            │
│    - Remove technical jargon                        │
│    - ESL-friendly language: avoid idioms            │
│    Text: [original text]"                          │
│     ↓                                               │
│ GeminiClient.rewrite(prompt)                       │
│     ↓                                               │
│ BaseHttpClient.post(                                │
│   'https://generativelanguage.googleapis.com/...',│
│   { contents: [{ parts: [{ text: prompt }] }] },  │
│   { params: { key: '...' } }                       │
│ )                                                   │
│     ↓                                               │
│ Result: "Mitochondria creates energy for cells."   │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│ STEP 3: Speech Synthesis                           │
│ SpeechSynthesisService.synthesize(simplifiedText)  │
│     ↓                                               │
│ ElevenLabsClient.synthesize(text)                  │
│     ↓                                               │
│ BaseHttpClient.axiosInstance.post(                 │
│   'https://api.elevenlabs.io/v1/text-to-speech/...',│
│   { text, voice_settings },                         │
│   { headers: { 'xi-api-key': '...' },              │
│     responseType: 'arraybuffer' }                   │
│ )                                                   │
│     ↓                                               │
│ Buffer.from(response.data).toString('base64')      │
│     ↓                                               │
│ Result: "SGVsbG8gd29ybGQ..." (base64 audio)        │
└─────────────────────────────────────────────────────┘
    ↓
Return to controller:
  {
    originalText: "The mitochondria is the powerhouse...",
    simplifiedText: "Mitochondria creates energy for cells.",
    audioBase64: "SGVsbG8gd29ybGQ..."
  }
```

### 5. Response to Client

```
SpeechController returns JSON:
  {
    originalText: "...",
    simplifiedText: "...",
    audioBase64: "..."
  }
    ↓
SpeechSimplifierApp.processRecording() receives response
    ↓
Update DOM:
  - Display originalText in #original
  - Display simplifiedText in #simplified
  - Create audio element with base64 data
    ↓
Auto-play audio
    ↓
Show success status
```

---

## Error Handling Flow

```
Any layer throws error
    ↓
Caught in try/catch or passed to next()
    ↓
errorHandler middleware (last in chain)
    ↓
Identify error type:
  ├─ ValidationError → 400 Bad Request
  ├─ ExternalAPIError → 502 Bad Gateway
  ├─ ConfigurationError → 500 Internal Server Error
  └─ Unknown Error → 500 Internal Server Error
    ↓
Log error with context:
  {
    timestamp: "...",
    method: "POST",
    path: "/process",
    error: { name, message, code, statusCode }
  }
    ↓
Return JSON response:
  {
    error: "descriptive message",
    code: "ERROR_CODE",
    statusCode: 400
  }
    ↓
Frontend displays error in status element
```

---

## Dependency Injection

The `container.js` creates all dependencies in the correct order:

```
createContainer()
    ↓
1. Create BaseHttpClient
    ↓
2. Create API Clients
    ├─ GradiumClient(config, httpClient)
    ├─ GeminiClient(config, httpClient)
    └─ ElevenLabsClient(config, httpClient)
    ↓
3. Create Services
    ├─ TranscriptionService(gradiumClient)
    ├─ TextSimplificationService(geminiClient)
    ├─ SpeechSynthesisService(elevenLabsClient)
    └─ SpeechProcessingService(
         transcriptionService,
         textSimplificationService,
         speechSynthesisService
       )
    ↓
4. Create Validators
    ├─ AudioValidator(config)
    └─ PreferencesValidator()
    ↓
5. Create Controllers
    └─ SpeechController(
         speechProcessingService,
         audioValidator,
         preferencesValidator
       )
    ↓
Return:
  { controllers: { speechController } }
```

**Benefits:**
- Dependencies are explicit (easy to understand)
- Easy to mock for testing
- Easy to swap implementations (e.g., use different AI provider)
- No global state or singletons

---

## Configuration Management

All configuration centralized in `src/config/index.js`:

```javascript
export const config = {
  server: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowInsecureHttps: ...
  },
  api: {
    gradium: { apiKey, endpoint },
    gemini: { apiKey, endpoint, model },
    elevenlabs: { apiKey, endpoint, voiceId, voiceSettings }
  },
  upload: {
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    allowedMimeTypes: [...]
  }
}
```

**Used by:**
- BaseHttpClient (HTTPS settings)
- API Clients (endpoints, auth)
- AudioValidator (file size limits)
- Server bootstrap (port)

---

## Preferences Implementation ⭐

### Before Refactoring
```javascript
// Old server.js line 100
const simplified = await rewriteText(transcript, req.body.prefs);

// Old rewriteText function - prefs parameter IGNORED
async function rewriteText(text, prefs) {
  const prompt = `
You are an accessibility-focused language rewriter.
Rules:
- Preserve meaning exactly
- Use simpler vocabulary
...
`;
  // prefs never used!
}
```

### After Refactoring
```javascript
// TextSimplificationService.js
buildPrompt(text, preferences) {
  const {
    complexity = 'simple',
    removeJargon = true,
    esl = true
  } = preferences;

  const rules = ['Preserve meaning exactly', 'Output TEXT ONLY'];

  // DYNAMIC RULES based on complexity
  if (complexity === 'very-simple') {
    rules.push('Use only common words (5th grade level)');
    rules.push('Use very short sentences (5-10 words)');
  } else if (complexity === 'simple') {
    rules.push('Use simpler vocabulary');
    rules.push('Use short sentences');
  }

  // CONDITIONAL RULES based on preferences
  if (removeJargon) {
    rules.push('Remove technical jargon');
  }

  if (esl) {
    rules.push('ESL-friendly: avoid idioms');
  }

  return `You are an accessibility-focused rewriter.\n\nRules:\n${rules.map(r => `- ${r}`).join('\n')}\n\nText:\n${text}`;
}
```

**Result:** The prompt dynamically adjusts based on user preferences! 🎉

---

## Testing Strategy (Future)

### Unit Tests
```
validators/
  ✓ AudioValidator.validate() with valid file
  ✓ AudioValidator.validate() with oversized file
  ✓ PreferencesValidator.validate() with valid prefs
  ✓ PreferencesValidator.validate() with invalid complexity

services/
  ✓ TextSimplificationService.buildPrompt() with different preferences
  ✓ TranscriptionService.transcribe() with mocked client

clients/
  ✓ GradiumClient.transcribe() with mocked httpClient
  ✓ Error handling in BaseHttpClient
```

### Integration Tests
```
✓ POST /process with valid audio → 200 OK
✓ POST /process without audio → 400 Bad Request
✓ POST /process with oversized file → 400 Bad Request
✓ POST /process with invalid preferences → 400 Bad Request
✓ GET /health → 200 OK
```

### End-to-End Tests
```
✓ Record audio → transcribe → simplify → synthesize → play
✓ Change preferences → verify different output
✓ API failure → proper error message displayed
```

---

## Scalability Considerations

### Current Limitations
- Synchronous processing (user waits for all 3 API calls)
- No caching (repeated requests cost money)
- No rate limiting (vulnerable to abuse)
- Single server instance

### Future Improvements
1. **Queue-based processing**: Use Bull/BullMQ for background jobs
2. **Caching**: Redis for transcription/simplification results
3. **Rate limiting**: `express-rate-limit` middleware
4. **Horizontal scaling**: Load balancer + multiple instances
5. **Monitoring**: Prometheus metrics, error tracking (Sentry)
6. **Database**: Store user preferences, processing history

---

## Security Checklist

- ✅ No hard-coded secrets in code
- ✅ `.env` in `.gitignore`
- ⚠️ API keys need rotation (exposed in planning phase)
- ✅ File size validation (prevents large uploads)
- ✅ File type validation (prevents malicious files)
- ✅ Input validation (prevents injection)
- ✅ Error messages don't leak sensitive info
- ⏳ TODO: Add rate limiting
- ⏳ TODO: Add request size limits
- ⏳ TODO: Add CORS whitelist (currently allows all origins)

---

## Performance Metrics

### Before Refactoring
- Single file execution
- No error recovery
- No metrics/logging

### After Refactoring
- Layered execution with clear boundaries
- Comprehensive error handling
- Structured logging (can add timing)
- 30-second timeout per HTTP request

### Typical Request Timeline
```
1. Audio upload: ~100-500ms (depends on file size)
2. Speech-to-text: ~2-5s (Gradium API)
3. Text simplification: ~1-3s (Gemini API)
4. Text-to-speech: ~2-4s (ElevenLabs API)
───────────────────────────────────────────
Total: ~5-12 seconds
```

---

## Summary

The refactored Clarity-AI architecture provides:

1. **Clear separation of concerns** (routes → controllers → services → clients)
2. **Testable components** (dependency injection)
3. **Maintainable code** (single responsibility, no duplication)
4. **Functional preferences** (dynamic prompt building)
5. **Robust error handling** (validation, error classes, global handler)
6. **Production-ready** (logging, health checks, validation)

The architecture is designed to be extended, not just maintained! 🚀
