class SpeechSimplifierApp {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];

    this.elements = {
      recordBtn: document.getElementById('record'),
      stopBtn: document.getElementById('stop'),
      originalText: document.getElementById('original'),
      simplifiedText: document.getElementById('simplified'),
      audio: document.getElementById('audio'),
      originalAudio: document.getElementById('originalAudio'),
      status: document.getElementById('status'),
      complexitySelect: document.getElementById('complexity'),
      removeJargonCheckbox: document.getElementById('removeJargon'),
      eslCheckbox: document.getElementById('esl'),
      stage1Status: document.getElementById('stage1Status'),
      stage2Status: document.getElementById('stage2Status'),
      stage3Status: document.getElementById('stage3Status'),
      stage4Status: document.getElementById('stage4Status')
    };

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.elements.recordBtn.onclick = () => this.startRecording();
    this.elements.stopBtn.onclick = () => this.stopRecording();
    this.resetStages();
  }

  resetStages() {
    // Reset all stages to waiting
    this.updateStageStatus(1, 'waiting', '⏳ Waiting...');
    this.updateStageStatus(2, 'waiting', '⏳ Waiting...');
    this.updateStageStatus(3, 'waiting', '⏳ Waiting...');
    this.updateStageStatus(4, 'waiting', '⏳ Waiting...');

    // Clear content
    this.elements.originalText.textContent = '';
    this.elements.simplifiedText.textContent = '';
    this.elements.originalAudio.src = '';
    this.elements.audio.src = '';
  }

  updateStageStatus(stage, status, message) {
    const element = this.elements[`stage${stage}Status`];
    element.textContent = message;
    element.className = `stage-status ${status}`;
  }

  async startRecording() {
    try {
      this.resetStages();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
      this.mediaRecorder.onstop = () => this.processRecording();

      this.mediaRecorder.start();
      this.updateUIState('recording');
      this.setStatus('Recording...', 'info');
      this.updateStageStatus(1, 'processing', '🎤 Recording audio...');
    } catch (error) {
      this.setStatus(`Error accessing microphone: ${error.message}`, 'error');
      console.error('Error starting recording:', error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      this.updateUIState('processing');
      this.setStatus('Processing...', 'info');
    }
  }

  async processRecording() {
    try {
      const blob = new Blob(this.chunks, { type: 'audio/wav' });

      // Stage 1: Original Recording Complete
      const originalAudioUrl = URL.createObjectURL(blob);
      this.elements.originalAudio.src = originalAudioUrl;
      this.updateStageStatus(1, 'complete', '✅ Audio recorded');

      // Stage 2: Send for transcription
      this.updateStageStatus(2, 'processing', '🔄 Transcribing audio...');
      this.setStatus('Sending audio for processing...', 'info');

      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('prefs', JSON.stringify(this.getPreferences()));

      const response = await fetch('/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const data = await response.json();

      // Stage 2: Transcription Complete - Display immediately
      this.elements.originalText.textContent = data.originalText;
      this.updateStageStatus(2, 'complete', '✅ Text transcribed');

      // Stage 3: Simplification Complete - Display immediately
      this.updateStageStatus(3, 'complete', '✅ Text simplified');
      this.elements.simplifiedText.textContent = data.simplifiedText;

      // Stage 4: Speech Synthesis Complete - Display immediately
      this.updateStageStatus(4, 'complete', '✅ Audio synthesized');
      this.elements.audio.src = `data:audio/mp3;base64,${data.audioBase64}`;

      await this.elements.audio.play();

      this.setStatus('✨ All stages complete! Audio playing.', 'success');
      this.updateUIState('ready');
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'error');
      this.updateStageStatus(2, 'error', '❌ Processing failed');
      this.updateStageStatus(3, 'error', '❌ Skipped');
      this.updateStageStatus(4, 'error', '❌ Skipped');
      console.error('Error processing recording:', error);
      this.updateUIState('ready');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPreferences() {
    return {
      complexity: this.elements.complexitySelect.value,
      removeJargon: this.elements.removeJargonCheckbox.checked,
      esl: this.elements.eslCheckbox.checked
    };
  }

  updateUIState(state) {
    switch (state) {
      case 'recording':
        this.elements.recordBtn.disabled = true;
        this.elements.stopBtn.disabled = false;
        this.elements.complexitySelect.disabled = true;
        this.elements.removeJargonCheckbox.disabled = true;
        this.elements.eslCheckbox.disabled = true;
        break;
      case 'processing':
        this.elements.recordBtn.disabled = true;
        this.elements.stopBtn.disabled = true;
        this.elements.complexitySelect.disabled = true;
        this.elements.removeJargonCheckbox.disabled = true;
        this.elements.eslCheckbox.disabled = true;
        break;
      case 'ready':
      default:
        this.elements.recordBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.elements.complexitySelect.disabled = false;
        this.elements.removeJargonCheckbox.disabled = false;
        this.elements.eslCheckbox.disabled = false;
        break;
    }
  }

  setStatus(message, type = 'info') {
    this.elements.status.textContent = message;
    this.elements.status.className = `status status-${type}`;
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SpeechSimplifierApp());
} else {
  new SpeechSimplifierApp();
}
