/**
 * Web Audio API and Haptic feedback cues for visually impaired users.
 * Delivers distinct tactile and acoustic indicators for assistant events.
 */

class AudioHapticsService {
  private audioCtx: AudioContext | null = null;

  private initCtx() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play a simple synthesized tone
  playTone(freq: number, type: OscillatorType, durationMs: number, gainValue = 0.15) {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(gainValue, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  }

  // Vibrate device if supported
  vibrate(pattern: number | number[]) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignore haptics failure if blocked by permissions
      }
    }
  }

  // Sound: Speech recognition started listening (gentle rising chime)
  playListeningStart() {
    this.playTone(440, 'sine', 120, 0.12);
    setTimeout(() => this.playTone(880, 'sine', 160, 0.15), 90);
    this.vibrate(60);
  }

  // Sound: Speech recognition ended / captured
  playListeningStop() {
    this.playTone(880, 'sine', 100, 0.12);
    setTimeout(() => this.playTone(440, 'sine', 120, 0.1), 80);
    this.vibrate([40, 30, 40]);
  }

  // Sound: Object / scene detected ping
  playDetectionPing() {
    this.playTone(659.25, 'triangle', 180, 0.1);
    this.vibrate(80);
  }

  // Sound: Immediate obstacle warning (urgent high-pitch double beep)
  playObstacleWarning() {
    this.playTone(987.77, 'sawtooth', 140, 0.25);
    setTimeout(() => this.playTone(987.77, 'sawtooth', 180, 0.25), 160);
    this.vibrate([150, 80, 150]);
  }

  // Sound: Low-light detected alert
  playLowLightAlert() {
    this.playTone(330, 'sine', 200, 0.15);
    setTimeout(() => this.playTone(260, 'sine', 250, 0.15), 180);
    this.vibrate([80, 50, 80]);
  }

  // Sound: Emergency SOS alarm siren
  playSOSSiren() {
    this.playTone(1046.5, 'square', 250, 0.3);
    setTimeout(() => this.playTone(784.0, 'square', 250, 0.3), 260);
    this.vibrate([300, 100, 300, 100, 500]);
  }

  // Sound: Success confirmation
  playSuccess() {
    this.playTone(523.25, 'sine', 100, 0.15);
    setTimeout(() => this.playTone(659.25, 'sine', 100, 0.15), 100);
    setTimeout(() => this.playTone(783.99, 'sine', 150, 0.15), 200);
    this.vibrate(100);
  }
}

export const audioHaptics = new AudioHapticsService();
