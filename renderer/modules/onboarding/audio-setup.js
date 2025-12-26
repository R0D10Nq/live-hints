/**
 * Onboarding Audio Setup - настройка микрофона и VU meter
 */

export class AudioSetup {
  constructor(app) {
    this.app = app;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.vuAnimationId = null;
  }

  async requestMicrophoneAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.app.settings.microphoneGranted = true;
      this.mediaStream = stream;

      this.updateMicStatus('granted', 'Доступ предоставлен');
      this.app.elements.btnRequestMic.disabled = true;
      this.app.elements.btnRequestMic.innerHTML = '<span class="btn-icon">✓</span> Доступ получен';

      this.app.elements.micDeviceSelection.classList.remove('hidden');
      await this.populateMicrophoneList();
      this.startVuMeter();
    } catch (err) {
      console.error('Microphone access denied:', err);
      this.updateMicStatus('denied', 'Доступ запрещён');
    }
  }

  updateMicStatus(status, text) {
    const statusIcon = this.app.elements.micStatus.querySelector('.status-icon');
    const statusText = this.app.elements.micStatus.querySelector('.status-text');

    statusIcon.className = 'status-icon ' + status;
    statusIcon.textContent = status === 'granted' ? '✓' : status === 'denied' ? '✕' : '○';
    statusText.textContent = text;
  }

  async populateMicrophoneList() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      this.app.elements.micSelect.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Микрофон ${index + 1}`;
        this.app.elements.micSelect.appendChild(option);
      });

      if (audioInputs.length > 0) {
        this.app.settings.microphoneId = audioInputs[0].deviceId;
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }

  startVuMeter(deviceId) {
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
    }

    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.mediaStream) {
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const vuBars = this.app.elements.micVuMeter.querySelectorAll('.vu-bar');

      const updateVu = () => {
        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const level = Math.min(average / 128, 1);

        vuBars.forEach((bar, index) => {
          const threshold = (index + 1) / vuBars.length;
          bar.classList.remove('active', 'warning', 'danger');

          if (level >= threshold) {
            if (index >= vuBars.length - 2) {
              bar.classList.add('danger');
            } else if (index >= vuBars.length - 4) {
              bar.classList.add('warning');
            } else {
              bar.classList.add('active');
            }
          }
        });

        this.vuAnimationId = requestAnimationFrame(updateVu);
      };

      updateVu();
    }
  }

  cleanup() {
    if (this.vuAnimationId) {
      cancelAnimationFrame(this.vuAnimationId);
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
