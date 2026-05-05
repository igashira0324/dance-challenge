import { BPM } from '../constants';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private startTime: number = 0;
  private isPlaying: boolean = false;
  private intervalId: number | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  async playDemo() {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    
    this.startTime = this.ctx!.currentTime;
    this.isPlaying = true;

    // Start a metronome/beat generator
    const beatDuration = 60 / BPM;
    
    const scheduleBeat = (time: number, measure: number) => {
      if (!this.isPlaying || !this.ctx) return;

      // Kick sound
      this.playOscillator(time, 150, 0.1, 'sine', 0.5);
      
      // Snare on 2 and 4
      if (measure % 2 === 1) {
        this.playNoise(time, 0.1, 0.2);
      }

      // Hi-hats on every beat
      this.playOscillator(time, 1000, 0.05, 'square', 0.1);

      // Simple bass line on 1
      if (measure % 4 === 0) {
        this.playOscillator(time, 50, 0.4, 'triangle', 0.4);
      }
    };

    let beatCount = 0;
    const lookAhead = 0.1;
    const interval = 100;

    const scheduler = () => {
      if (!this.isPlaying || !this.ctx) return;
      const currentTime = this.ctx.currentTime - this.startTime;
      const musicDuration = 20; // コンテンツに合わせて20秒まで延長

      if (currentTime >= musicDuration) {
        this.stop();
        return;
      }

      while (beatCount * beatDuration < currentTime + lookAhead) {
        scheduleBeat(this.startTime + beatCount * beatDuration, beatCount % 4);
        beatCount++;
      }
      this.intervalId = window.setTimeout(scheduler, interval);
    };

    scheduler();
  }

  getCurrentTime() {
    if (!this.isPlaying || !this.ctx) return 0;
    return this.ctx.currentTime - this.startTime;
  }

  private playOscillator(time: number, freq: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + duration);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playNoise(time: number, duration: number, volume: number) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) clearTimeout(this.intervalId);
  }
}

export const audioEngine = new AudioEngine();
