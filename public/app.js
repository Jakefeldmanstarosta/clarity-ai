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
      eslCheckbox: document.getElementById('esl')
    };

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.elements.recordBtn.onclick = () => this.startRecording();
    this.elements.stopBtn.onclick = () => this.stopRecording();
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
      this.mediaRecorder.onstop = () => this.processRecording();

      this.mediaRecorder.start();
      this.updateUIState('recording');
      this.setStatus('Recording...', 'info');
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

      // Set the original recorded audio for playback
      const originalAudioUrl = URL.createObjectURL(blob);
      this.elements.originalAudio.src = originalAudioUrl;

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

      this.elements.originalText.textContent = data.originalText;
      this.elements.simplifiedText.textContent = data.simplifiedText;

      this.elements.audio.src = `data:audio/mp3;base64,${data.audioBase64}`;
      await this.elements.audio.play();

      this.setStatus('Success! Audio processed and playing.', 'success');
      this.updateUIState('ready');
    } catch (error) {
      this.setStatus(`Error: ${error.message}`, 'error');
      console.error('Error processing recording:', error);
      this.updateUIState('ready');
    }
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
