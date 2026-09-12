import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';

export class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isSpeaking = false;
  private lastAnnouncedText = '';
  private lastAnnouncedTime = 0;
  private onStateChangeListeners: Array<(speaking: boolean, text: string) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public subscribe(cb: (speaking: boolean, text: string) => void) {
    this.onStateChangeListeners.push(cb);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter((l) => l !== cb);
    };
  }

  private notifyState(speaking: boolean, text: string) {
    this.isSpeaking = speaking;
    this.onStateChangeListeners.forEach((cb) => cb(speaking, text));
  }

  /**
   * Speak text with priority and deduplication.
   * @param text The text to vocalize
   * @param langCode Target language ('en' | 'ta' | 'ml' | 'te' | 'kn' | 'hi')
   * @param priority 'high' (interrupt immediately, e.g. obstacle/SOS), 'normal' (queue), 'low'
   * @param forceSpeak bypass deduplication check
   */
  public speak(
    text: string,
    langCode: SupportedLanguage = 'en',
    priority: 'high' | 'normal' | 'low' = 'normal',
    forceSpeak = false
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !text?.trim()) {
        resolve();
        return;
      }

      const cleanText = text.trim();
      const now = Date.now();

      // Deduplication: Avoid repeating exact unchanged text within 7 seconds unless high priority or forced
      if (!forceSpeak && priority !== 'high') {
        if (cleanText === this.lastAnnouncedText && now - this.lastAnnouncedTime < 7000) {
          resolve();
          return;
        }
      }

      // If high priority (e.g. emergency SOS or direct obstacle warning), stop ongoing speech immediately
      if (priority === 'high' && this.synth.speaking) {
        this.synth.cancel();
      } else if (this.synth.speaking && priority === 'low') {
        // Drop low priority if already busy
        resolve();
        return;
      }

      this.lastAnnouncedText = cleanText;
      this.lastAnnouncedTime = now;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      const targetLangTag = langConfig ? langConfig.speechCode : 'en-US';

      utterance.lang = targetLangTag;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select matching voice if available
      if (this.voices.length === 0) {
        this.loadVoices();
      }

      const matchedVoice =
        this.voices.find((v) => v.lang.toLowerCase() === targetLangTag.toLowerCase()) ||
        this.voices.find((v) => v.lang.toLowerCase().startsWith(langCode)) ||
        this.voices.find((v) => v.default);

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        this.notifyState(true, cleanText);
      };

      utterance.onend = () => {
        this.notifyState(false, '');
        resolve();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        this.notifyState(false, '');
        resolve();
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.notifyState(false, '');
    }
  }

  public getSpeakingState() {
    return this.isSpeaking;
  }
}

export const speechService = new SpeechService();
