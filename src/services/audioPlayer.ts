/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateGeminiTTS } from './gemini';
import { UserSettings } from '../types';

class SaraAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private isPlaying: boolean = false;
  private audioLevel: number = 0;
  private levelAnimFrame: number | null = null;
  private fallbackInterval: number | null = null;

  // Pre-load cache for whiteboard steps: Map<cacheKey, AudioBuffer>
  private preloadedBuffers: Map<string, AudioBuffer> = new Map();

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Decode base64 16-bit PCM or WAV into an AudioBuffer
   */
  public async decodeAudio(base64Data: string): Promise<AudioBuffer> {
    const ctx = this.initAudioContext();
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check if it has a RIFF WAV header
    const isWav =
      len >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46; // "RIFF"

    if (isWav) {
      try {
        return await ctx.decodeAudioData(bytes.buffer.slice(0));
      } catch (e) {
        console.warn('decodeAudioData failed on WAV, attempting manual PCM fallback', e);
      }
    }

    // Headerless raw 16-bit PCM little-endian at 24000 Hz
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const audioBuffer = ctx.createBuffer(1, int16.length, 24000);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) {
      channel[i] = int16[i] / 32768.0;
    }
    return audioBuffer;
  }

  /**
   * Play an AudioBuffer with AnalyserNode for lip-sync
   */
  public playBuffer(buffer: AudioBuffer, onEnded?: () => void): void {
    if (this.isMuted) {
      if (onEnded) onEnded();
      return;
    }

    const ctx = this.initAudioContext();
    this.stop(); // Stop any currently playing audio

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (this.analyser) {
      source.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    this.currentSource = source;
    this.isPlaying = true;
    this.startAudioLevelTracking();

    source.onended = () => {
      this.isPlaying = false;
      this.audioLevel = 0;
      this.stopAudioLevelTracking();
      if (onEnded) onEnded();
    };

    source.start(0);
  }

  /**
   * Speak a text string: tries Gemini TTS first, falls back to Web SpeechSynthesis
   */
  public async speakText(
    text: string,
    settings: UserSettings,
    cacheKey?: string,
    onEnded?: () => void
  ): Promise<void> {
    if (this.isMuted) {
      if (onEnded) onEnded();
      return;
    }

    // 1. Check if already pre-loaded
    if (cacheKey && this.preloadedBuffers.has(cacheKey)) {
      const buffer = this.preloadedBuffers.get(cacheKey)!;
      this.playBuffer(buffer, onEnded);
      return;
    }

    // 2. Try Gemini TTS
    try {
      const { audioBase64 } = await generateGeminiTTS(text, settings);
      const buffer = await this.decodeAudio(audioBase64);
      if (cacheKey) {
        this.preloadedBuffers.set(cacheKey, buffer);
      }
      this.playBuffer(buffer, onEnded);
      return;
    } catch (ttsError) {
      console.warn('Gemini TTS failed or unavailable, falling back to Web SpeechSynthesis:', ttsError);
    }

    // 3. Fallback to Browser SpeechSynthesis with high pitch
    this.speakWithBrowserFallback(text, onEnded);
  }

  /**
   * Pre-load audio for the next step to eliminate latency
   */
  public async preloadStepAudio(text: string, settings: UserSettings, cacheKey: string): Promise<void> {
    if (this.preloadedBuffers.has(cacheKey) || !text) return;
    try {
      const { audioBase64 } = await generateGeminiTTS(text, settings);
      const buffer = await this.decodeAudio(audioBase64);
      this.preloadedBuffers.set(cacheKey, buffer);
    } catch {
      // Silent fail on preload; will fallback when played
    }
  }

  /**
   * Browser SpeechSynthesis fallback with cute elevated pitch
   */
  private speakWithBrowserFallback(text: string, onEnded?: () => void): void {
    if (!('speechSynthesis' in window)) {
      if (onEnded) onEnded();
      return;
    }

    window.speechSynthesis.cancel();

    // Strip markdown and emojis
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*_#`~[\]]/g, '')
      .trim();

    if (!cleanText) {
      if (onEnded) onEnded();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = 1.4; // High pitch for cute anime girl effect
    utterance.rate = 1.05; // Slightly lively rate

    // Choose preferred female or natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Kavya')) &&
        (v.lang.startsWith('en') || v.lang.startsWith('hi'))
    ) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.isPlaying = true;
    this.startSimulatedAudioLevel();

    utterance.onend = () => {
      this.isPlaying = false;
      this.audioLevel = 0;
      this.stopSimulatedAudioLevel();
      if (onEnded) onEnded();
    };

    utterance.onerror = () => {
      this.isPlaying = false;
      this.audioLevel = 0;
      this.stopSimulatedAudioLevel();
      if (onEnded) onEnded();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Real-time audio amplitude tracker from AnalyserNode
   */
  private startAudioLevelTracking(): void {
    this.stopAudioLevelTracking();
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const update = () => {
      if (!this.isPlaying || !this.analyser) {
        this.audioLevel = 0;
        return;
      }
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Normalize and amplify for mouth movement (0 to 1)
      this.audioLevel = Math.min(1, Math.max(0, (avg / 128) * 1.5));
      this.levelAnimFrame = requestAnimationFrame(update);
    };
    this.levelAnimFrame = requestAnimationFrame(update);
  }

  private stopAudioLevelTracking(): void {
    if (this.levelAnimFrame !== null) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
  }

  private startSimulatedAudioLevel(): void {
    this.stopSimulatedAudioLevel();
    this.fallbackInterval = window.setInterval(() => {
      // Natural oscillating mouth flap
      this.audioLevel = 0.3 + Math.random() * 0.6;
    }, 120);
  }

  private stopSimulatedAudioLevel(): void {
    if (this.fallbackInterval !== null) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  /**
   * Current mouth opening level (0 = closed, 1 = fully open)
   */
  public getAudioLevel(): number {
    return this.audioLevel;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {}
      this.currentSource = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isPlaying = false;
    this.audioLevel = 0;
    this.stopAudioLevelTracking();
    this.stopSimulatedAudioLevel();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public clearCache(): void {
    this.preloadedBuffers.clear();
  }
}

export const audioPlayer = new SaraAudioPlayer();
