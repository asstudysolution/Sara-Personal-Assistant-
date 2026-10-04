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
   * Unlock AudioContext on user touch/tap gesture so autoplay works immediately
   */
  public unlockAudioContext(): void {
    try {
      const ctx = this.initAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 1, 24000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn('unlockAudioContext note:', e);
    }
  }

  /**
   * Play an AudioBuffer with AnalyserNode for lip-sync and report exact duration
   */
  public playBuffer(buffer: AudioBuffer, onEnded?: () => void, onStart?: (durationMs: number) => void): void {
    if (this.isMuted) {
      const simulatedDuration = buffer.duration * 1000;
      if (onStart) onStart(simulatedDuration);
      setTimeout(() => {
        if (onEnded) onEnded();
      }, simulatedDuration);
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

    const durationMs = buffer.duration * 1000;
    if (onStart) {
      onStart(durationMs);
    }

    source.onended = () => {
      this.isPlaying = false;
      this.audioLevel = 0;
      this.stopAudioLevelTracking();
      if (onEnded) onEnded();
    };

    source.start(0);
  }

  /**
   * Speak a text string: tries Gemini TTS first (with 1 retry), falls back to Web SpeechSynthesis
   */
  public async speakText(
    text: string,
    settings: UserSettings,
    cacheKey?: string,
    onEnded?: () => void,
    onStart?: (durationMs: number) => void,
    isTeaching: boolean = false
  ): Promise<void> {
    if (this.isMuted) {
      const words = text.trim().split(/\s+/).length;
      const estimatedMs = Math.max(2200, words * 380);
      if (onStart) onStart(estimatedMs);
      setTimeout(() => {
        if (onEnded) onEnded();
      }, estimatedMs);
      return;
    }

    // 1. Check if already pre-loaded
    if (cacheKey && this.preloadedBuffers.has(cacheKey)) {
      const buffer = this.preloadedBuffers.get(cacheKey)!;
      this.playBuffer(buffer, onEnded, onStart);
      return;
    }

    // 2. Try Gemini TTS with 1 retry on error (503, 429, timeout)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { audioBase64 } = await generateGeminiTTS(text, settings, isTeaching);
        const buffer = await this.decodeAudio(audioBase64);
        if (cacheKey) {
          this.preloadedBuffers.set(cacheKey, buffer);
        }
        this.playBuffer(buffer, onEnded, onStart);
        return;
      } catch (ttsError) {
        console.warn(`Gemini TTS attempt ${attempt + 1} failed:`, ttsError);
        if (attempt === 0) {
          // Brief pause before retry
          await new Promise((res) => setTimeout(res, 450));
        }
      }
    }

    // 3. Fallback to Browser SpeechSynthesis with high-quality hi-IN voice
    console.warn('Gemini TTS failed after retry, speaking with browser hi-IN voice');
    this.speakWithBrowserFallback(text, onEnded, onStart);
  }

  /**
   * Pre-load audio for the next step to eliminate latency
   */
  public async preloadStepAudio(
    text: string,
    settings: UserSettings,
    cacheKey: string,
    isTeaching: boolean = true
  ): Promise<void> {
    if (this.preloadedBuffers.has(cacheKey) || !text) return;
    try {
      const { audioBase64 } = await generateGeminiTTS(text, settings, isTeaching);
      const buffer = await this.decodeAudio(audioBase64);
      this.preloadedBuffers.set(cacheKey, buffer);
    } catch {
      // Silent fail on preload; will fallback or retry when played
    }
  }

  /**
   * Browser SpeechSynthesis fallback with sweet pitch and hi-IN pronunciation
   */
  private speakWithBrowserFallback(
    text: string,
    onEnded?: () => void,
    onStart?: (durationMs: number) => void
  ): void {
    if (!('speechSynthesis' in window)) {
      const words = text.trim().split(/\s+/).length;
      const fallbackMs = Math.max(2000, words * 380);
      if (onStart) onStart(fallbackMs);
      setTimeout(() => {
        if (onEnded) onEnded();
      }, fallbackMs);
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
    utterance.lang = 'hi-IN'; // Force Hindi language pronunciation
    utterance.pitch = 1.35; // Sweet elevated pitch
    utterance.rate = 1.0; // Natural rate

    // Look for Hindi voice first
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((v) => v.lang.startsWith('hi') || v.lang.includes('IN'));
    const preferredVoice = hindiVoice || voices.find(
      (v) =>
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Lekha') || v.name.includes('Kalpana'))
    ) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.isPlaying = true;
    this.startSimulatedAudioLevel();

    const wordCount = cleanText.split(/\s+/).length;
    const estimatedDuration = Math.max(2200, wordCount * 360);
    if (onStart) {
      onStart(estimatedDuration);
    }

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
