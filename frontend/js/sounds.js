class PokerSoundManager {
  constructor() {
    this.audioContext = null;
    this.masterVolume = 0.5;
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('[Sound] AudioContext not available:', e);
    }
  }

  ensureInit() {
    if (!this.initialized) this.init();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  _createOscillator(freq, type, duration, volume) {
    if (!this.enabled || !this.audioContext) return null;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    gain.gain.setValueAtTime((volume || 0.3) * this.masterVolume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + (duration || 0.15));
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    return { osc, gain };
  }

  _playTone(freq, type, duration, volume) {
    const nodes = this._createOscillator(freq, type, duration, volume);
    if (!nodes) return;
    nodes.osc.start(this.audioContext.currentTime);
    nodes.osc.stop(this.audioContext.currentTime + (duration || 0.15));
  }

  _playNoise(duration, volume) {
    if (!this.enabled || !this.audioContext) return;
    const bufferSize = this.audioContext.sampleRate * (duration || 0.08);
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime((volume || 0.2) * this.masterVolume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + (duration || 0.08));
    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start();
  }

  fold() {
    this.ensureInit();
    this._playTone(200, 'triangle', 0.2, 0.25);
    setTimeout(() => this._playTone(150, 'sawtooth', 0.15, 0.15), 80);
  }

  check() {
    this.ensureInit();
    this._playTone(600, 'sine', 0.06, 0.12);
  }

  call() {
    this.ensureInit();
    this._playTone(523, 'sine', 0.1, 0.2);
    setTimeout(() => this._playTone(659, 'sine', 0.1, 0.18), 70);
  }

  bet() {
    this.ensureInit();
    this._playTone(440, 'square', 0.08, 0.15);
    this._noiseBurst(0.05, 0.08);
  }

  raise() {
    this.ensureInit();
    this._playTone(330, 'square', 0.1, 0.2);
    setTimeout(() => this._playTone(494, 'square', 0.12, 0.22), 60);
    setTimeout(() => this._playTone(659, 'square', 0.14, 0.25), 130);
    this._noiseBurst(0.08, 0.1);
  }

  allIn() {
    this.ensureInit();
    const baseFreq = 300;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this._playTone(baseFreq + i * 100, 'sawtooth', 0.12, 0.22 - i * 0.02);
        this._noiseBurst(0.04, 0.06);
      }, i * 50);
    }
  }

  dealCard() {
    this.ensureInit();
    this._playTone(800 + Math.random() * 400, 'sine', 0.04, 0.1);
    this._noiseBurst(0.03, 0.05);
  }

  dealHoleCards() {
    this.ensureInit();
    this.dealCard();
    setTimeout(() => this.dealCard(), 100);
    if (Math.random() > 0.5) {
      setTimeout(() => this.dealCard(), 200);
      setTimeout(() => this.dealCard(), 300);
    }
  }

  yourTurn() {
    this.ensureInit();
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 'sine', 0.12, 0.25), i * 120);
    });
  }

  blindsSet() {
    this.ensureInit();
    this._playTone(220, 'triangle', 0.15, 0.2);
    setTimeout(() => this._playTone(277, 'triangle', 0.15, 0.2), 150);
  }

  blindRaise() {
    this.ensureInit();
    this._playTone(350, 'sawtooth', 0.2, 0.3);
    setTimeout(() => this._playTone(440, 'sawtooth', 0.25, 0.35), 120);
    setTimeout(() => this._playTone(550, 'sawtooth', 0.3, 0.4), 260);
  }

  flopCards() {
    this.ensureInit();
    [0, 180, 360].forEach(delay => {
      setTimeout(() => this.dealCard(), delay);
    });
  }

  turnRiver() {
    this.ensureInit();
    this.dealCard();
  }

  winner() {
    this.ensureInit();
    const melody = [523, 587, 659, 698, 784, 880, 988, 1047];
    melody.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 'sine', 0.18, 0.28), i * 90);
    });
  }

  showDown() {
    this.ensureInit();
    this._playTone(400, 'triangle', 0.15, 0.2);
    this._noiseBurst(0.08, 0.1);
  }

  chipCollect() {
    this.ensureInit();
    this._noiseBurst(0.06, 0.12);
    this._playTone(900, 'sine', 0.06, 0.08);
  }

  nextHand() {
    this.ensureInit();
    this._playTone(392, 'sine', 0.1, 0.15);
    setTimeout(() => this._playTone(523, 'sine', 0.1, 0.18), 100);
  }

  playerJoin() {
    this.ensureInit();
    this._playTone(700, 'sine', 0.1, 0.15);
  }

  gameStart() {
    this.ensureInit();
    const fanfare = [523, 659, 784, 1047];
    fanfare.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 'sine', 0.2, 0.3), i * 150);
    });
  }

  _noiseBurst(duration, volume) {
    if (!this.enabled || !this.audioContext) return;
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(volume * this.masterVolume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start();
  }
}

const pokerSoundManager = new PokerSoundManager();

try {
  module.exports = pokerSoundManager;
} catch (e) {
  window.pokerSoundManager = pokerSoundManager;
}
