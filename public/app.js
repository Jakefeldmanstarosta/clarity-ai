const { useEffect, useRef, useState } = React;

const PCM_SAMPLE_RATE = 24000;
const PCM_FRAME_SAMPLES = 1920;
const PCM_BYTES_PER_SAMPLE = 2;


const defaultStages = {
  1: { status: 'waiting', message: 'Waiting...' },
  2: { status: 'waiting', message: 'Waiting...' },
  3: { status: 'waiting', message: 'Waiting...' },
  4: { status: 'waiting', message: 'Waiting...' }
};

function App() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const synthAudioRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const pcmSendBufferRef = useRef(new Int16Array(0));
  const pcmRecordedChunksRef = useRef([]);

  const [status, setStatus] = useState({ message: '', type: 'info', visible: false });
  const [stages, setStages] = useState(defaultStages);
  const [originalText, setOriginalText] = useState('');
  const [simplifiedText, setSimplifiedText] = useState('');
  const [originalAudioUrl, setOriginalAudioUrl] = useState('');
  const [synthAudioUrl, setSynthAudioUrl] = useState('');

  const [complexity, setComplexity] = useState('simple');
  const [removeJargon, setRemoveJargon] = useState(true);
  const [esl, setEsl] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const [speechSpeed, setSpeechSpeed] = useState(1.0);

  const [uiState, setUiState] = useState('ready');
  const transcriptRef = useRef('');
  const updateRunningTranscript = updateRunningTranscriptFactory(setOriginalText, transcriptRef);

  const speedOptions = [
    { label: 'Slow', value: 0.85 },
    { label: 'Normal', value: 1.0 },
    { label: 'Fast', value: 1.15 }
  ];

  const isEditableTarget = (event) => {
    const target = event.target;
    if (!target) {
      return false;
    }

    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (originalAudioUrl) {
        URL.revokeObjectURL(originalAudioUrl);
      }
    };
  }, [originalAudioUrl]);

  useEffect(() => {
    if (synthAudioUrl && synthAudioRef.current) {
      synthAudioRef.current.play().catch(() => {});
    }
  }, [synthAudioUrl]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) {
        return;
      }

      if (isEditableTarget(event)) {
        return;
      }

      if (uiState !== 'ready') {
        return;
      }

      event.preventDefault();
      startRecording();
    };

    const handleKeyUp = (event) => {
      if (event.code !== 'Space') {
        return;
      }

      if (isEditableTarget(event)) {
        return;
      }

      if (uiState !== 'recording') {
        return;
      }

      event.preventDefault();
      stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [uiState, startRecording, stopRecording]);

  const updateStageStatus = (stage, statusValue, message) => {
    setStages(prev => ({
      ...prev,
      [stage]: { status: statusValue, message }
    }));
  };

  const resetStages = () => {
    setStages(defaultStages);
    setOriginalText('');
    setSimplifiedText('');
    setOriginalAudioUrl('');
    setSynthAudioUrl('');
    pcmRecordedChunksRef.current = [];
    transcriptRef.current = '';
  };

  const setStatusMessage = (message, type = 'info') => {
    setStatus({ message, type, visible: true });
  };

  const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  };

  const startRecording = async () => {
    try {
      resetStages();
      setUiState('recording');
      setStatusMessage('Connecting...', 'info');
      updateStageStatus(1, 'processing', 'Connecting...');

      // Connect to WebSocket
      const wsUrl = `ws://${window.location.hostname}:${window.location.port}/ws/transcribe`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusMessage('Connected. Waiting for ready...', 'info');
        updateStageStatus(1, 'processing', 'Waiting for ready...');
        updateStageStatus(2, 'processing', 'Waiting for ready...');
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'ready') {
          console.log('[RT] Transcription service ready');
          if (mediaRecorderRef.current || streamRef.current) {
            return;
          }

          (async () => {
            try {
              setStatusMessage('Recording...', 'info');
              updateStageStatus(1, 'processing', 'Recording audio...');
              updateStageStatus(2, 'processing', 'Transcribing in real-time...');

              // Get microphone stream
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;

              const audioContext = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
              audioContextRef.current = audioContext;

              const source = audioContext.createMediaStreamSource(stream);
              sourceRef.current = source;

              const processor = audioContext.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (event) => {
                if (ws.readyState !== WebSocket.OPEN) {
                  return;
                }

                const input = event.inputBuffer.getChannelData(0);
                const pcm16 = floatTo16BitPCM(input);

                pcmRecordedChunksRef.current.push(pcm16);

                pcmSendBufferRef.current = appendInt16(
                  pcmSendBufferRef.current,
                  pcm16
                );

                while (pcmSendBufferRef.current.length >= PCM_FRAME_SAMPLES) {
                  const frame = pcmSendBufferRef.current.subarray(0, PCM_FRAME_SAMPLES);
                  const frameBuffer = frame.buffer.slice(
                    frame.byteOffset,
                    frame.byteOffset + frame.byteLength
                  );

                  ws.send(frameBuffer);

                  pcmSendBufferRef.current = pcmSendBufferRef.current.subarray(PCM_FRAME_SAMPLES);
                }
              };

              source.connect(processor);
              processor.connect(audioContext.destination);
            } catch (error) {
              console.error('[RT] Mic error:', error);
              setStatusMessage(`Error: ${error.message}`, 'error');
              setUiState('ready');
            }
          })();
        } else if (message.type === 'text') {
          // Update transcription in real-time
          updateRunningTranscript(message.text);
        } else if (message.type === 'end') {
          // Final transcription received
          updateStageStatus(2, 'complete', 'Transcription complete');
        } else if (message.type === 'error') {
          console.error('[RT] Error:', message.error);
          setStatusMessage(`Error: ${message.error}`, 'error');
        }
      };

      ws.onerror = (error) => {
        console.error('[RT] WebSocket error:', error);
        setStatusMessage('Connection error', 'error');
        setUiState('ready');
      };

      ws.onclose = () => {
        console.log('[RT] WebSocket closed');
      };

    } catch (error) {
      setStatusMessage(`Error: ${error.message}`, 'error');
      setUiState('ready');
    }
  };

  const stopRecording = () => {
    setUiState('processing');
    setStatusMessage('Finishing transcription...', 'info');

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('END');

      setTimeout(() => {
        processSimplificationAndSynthesis();
      }, 1000);
    } else {
      processSimplificationAndSynthesis();
    }
  };

  const processSimplificationAndSynthesis = async () => {
    try {
      // Save original audio
      const wavData = encodeWavFromChunks(pcmRecordedChunksRef.current, PCM_SAMPLE_RATE);
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const originalAudio = URL.createObjectURL(blob);
      setOriginalAudioUrl(originalAudio);
      updateStageStatus(1, 'complete', 'Audio recorded');

      // Get current transcribed text
      const transcribedText = transcriptRef.current;
      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('No transcription available');
      }

      // Stage 3: Simplify text
      updateStageStatus(3, 'processing', 'Simplifying text...');
      setStatusMessage('Simplifying text...', 'info');

      const simplifyData = await requestJson('/process/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcribedText,
          prefs: {
            complexity,
            removeJargon,
            esl,
            customInstructions
          }
        })
      });

      setSimplifiedText(simplifyData.simplifiedText);
      updateStageStatus(3, 'complete', 'Text simplified');

      // Stage 4: Synthesize audio
      updateStageStatus(4, 'processing', 'Synthesizing audio...');
      setStatusMessage('Synthesizing audio...', 'info');

      const synthData = await requestJson('/process/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simplifyData.simplifiedText,
          speed: speechSpeed
        })
      });

      updateStageStatus(4, 'complete', 'Audio synthesized');
      setSynthAudioUrl(`data:audio/mp3;base64,${synthData.audioBase64}`);

      setStatusMessage('All stages complete! Audio playing.', 'success');
      setUiState('ready');

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`, 'error');
      updateStageStatus(3, 'error', 'Failed');
      updateStageStatus(4, 'error', 'Skipped');
      setUiState('ready');

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }
  };

  const processRecording = async () => {
    let currentStage = 1;

    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
      const originalAudio = URL.createObjectURL(blob);
      setOriginalAudioUrl(originalAudio);
      updateStageStatus(1, 'complete', 'Audio recorded');

      updateStageStatus(2, 'processing', 'Transcribing audio...');
      setStatusMessage('Transcribing audio...', 'info');
      currentStage = 2;

      const transcribeForm = new FormData();
      transcribeForm.append('audio', blob);

      const transcribeData = await requestJson('/process/transcribe', {
        method: 'POST',
        body: transcribeForm
      });

      setOriginalText(transcribeData.originalText);
      updateStageStatus(2, 'complete', 'Text transcribed');

      updateStageStatus(3, 'processing', 'Simplifying text...');
      setStatusMessage('Simplifying text...', 'info');
      currentStage = 3;

      const simplifyData = await requestJson('/process/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcribeData.originalText,
          prefs: {
            complexity,
            removeJargon,
            esl,
            customInstructions
          }
        })
      });

      setSimplifiedText(simplifyData.simplifiedText);
      updateStageStatus(3, 'complete', 'Text simplified');

      updateStageStatus(4, 'processing', 'Synthesizing audio...');
      setStatusMessage('Synthesizing audio...', 'info');
      currentStage = 4;

      const synthData = await requestJson('/process/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simplifyData.simplifiedText,
          speed: speechSpeed
        })
      });

      updateStageStatus(4, 'complete', 'Audio synthesized');
      setSynthAudioUrl(`data:audio/mp3;base64,${synthData.audioBase64}`);

      setStatusMessage('All stages complete! Audio playing.', 'success');
      setUiState('ready');
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`, 'error');
      if (currentStage === 2) {
        updateStageStatus(2, 'error', 'Transcription failed');
        updateStageStatus(3, 'error', 'Skipped');
        updateStageStatus(4, 'error', 'Skipped');
      } else if (currentStage === 3) {
        updateStageStatus(3, 'error', 'Simplification failed');
        updateStageStatus(4, 'error', 'Skipped');
      } else if (currentStage === 4) {
        updateStageStatus(4, 'error', 'Synthesis failed');
      } else {
        updateStageStatus(2, 'error', 'Processing failed');
        updateStageStatus(3, 'error', 'Skipped');
        updateStageStatus(4, 'error', 'Skipped');
      }
      setUiState('ready');
    }
  };

  const controlsDisabled = uiState === 'recording' || uiState === 'processing';

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <h1>Clarity-AI</h1>
          <p className="subtitle">Speech-to-speech accessibility platform</p>
        </div>

        <div className="top-controls">
          <div className="card">
            <h3>Settings</h3>
            <div className="settings">
              <div className="settings-row">
                <div className="pref-group">
                  <label htmlFor="complexity">Complexity Level</label>
                  <select
                    id="complexity"
                    value={complexity}
                    onChange={(event) => setComplexity(event.target.value)}
                    disabled={controlsDisabled}
                  >
                    <option value="very-simple">Very Simple (5th grade level)</option>
                    <option value="simple">Simple</option>
                    <option value="moderate">Moderate</option>
                  </select>
                </div>
                <div className="pref-group">
                  <label>Filters</label>
                  <div className="checkbox-group">
                    <label className="checkbox-item" htmlFor="removeJargon">
                      <input
                        type="checkbox"
                        id="removeJargon"
                        checked={removeJargon}
                        onChange={(event) => setRemoveJargon(event.target.checked)}
                        disabled={controlsDisabled}
                      />
                      Remove Jargon
                    </label>
                    <label className="checkbox-item" htmlFor="esl">
                      <input
                        type="checkbox"
                        id="esl"
                        checked={esl}
                        onChange={(event) => setEsl(event.target.checked)}
                        disabled={controlsDisabled}
                      />
                      ESL-Friendly
                    </label>
                  </div>
                </div>
              </div>
              <div className="pref-group">
                <label htmlFor="customInstructions">Custom Instructions (optional)</label>
                <input
                  type="text"
                  id="customInstructions"
                  value={customInstructions}
                  onChange={(event) => setCustomInstructions(event.target.value)}
                  disabled={controlsDisabled}
                  style={{
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--panel-strong)',
                    fontFamily: 'inherit',
                    color: 'var(--ink)',
                    width: '100%'
                  }}
                />
              </div>
              <div className="pref-group">
                <label>Speech Speed</label>
                <div className="segmented" role="group" aria-label="Speech speed">
                  {speedOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`seg-button ${speechSpeed === option.value ? 'active' : ''}`}
                      onClick={() => setSpeechSpeed(option.value)}
                      disabled={controlsDisabled}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="recording-card">
              <h3>Recording</h3>
              <div className="controls">
                <button id="record" onClick={startRecording} disabled={uiState !== 'ready'}>
                  Start Recording
                </button>
                <button id="stop" onClick={stopRecording} disabled={uiState !== 'recording'}>
                  Stop Recording
                </button>
              </div>
              <p className="hint-text">Press [space] to record</p>
              
            </div>
          </div>
        </div>
      </header>

      <div className={`status ${status.visible ? '' : 'empty-status'} status-${status.type}`}>
        {status.message}
      </div>

      <section className="panels">
        <div className="card panel">
          <div className="audio-corner audio-right">
            <audio controls src={originalAudioUrl || ''}></audio>
          </div>
          <h3>Raw Transcript</h3>
          <div className={`stage-status ${stages[2].status}`}>{stages[2].message}</div>
          <pre>{originalText}</pre>
        </div>

        <div className="card panel">
          <div className="audio-corner audio-right">
            <audio controls ref={synthAudioRef} src={synthAudioUrl || ''}></audio>
          </div>
          <h3>Filtered Transcript</h3>
          <div className={`stage-status ${stages[3].status}`}>{stages[3].message}</div>
    
          <pre>{simplifiedText}</pre>
        </div>
      </section>

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

function updateRunningTranscriptFactory(setOriginalText, transcriptRef) {
  return (incomingText) => {
    if (!incomingText || typeof incomingText !== 'string') {
      return;
    }

    const current = transcriptRef.current || '';
    let next = current;

    if (incomingText.startsWith(current)) {
      next = incomingText;
    } else if (current.startsWith(incomingText)) {
      next = current;
    } else {
      next = `${current} ${incomingText}`.trim();
    }

    transcriptRef.current = next;
    setOriginalText(next);
  };
}

function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function appendInt16(existing, incoming) {
  if (!existing || existing.length === 0) {
    return incoming;
  }
  const merged = new Int16Array(existing.length + incoming.length);
  merged.set(existing, 0);
  merged.set(incoming, existing.length);
  return merged;
}

function encodeWavFromChunks(chunks, sampleRate) {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + totalLength * PCM_BYTES_PER_SAMPLE);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalLength * PCM_BYTES_PER_SAMPLE, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(32, PCM_BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, totalLength * PCM_BYTES_PER_SAMPLE, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      view.setInt16(offset, chunk[i], true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
