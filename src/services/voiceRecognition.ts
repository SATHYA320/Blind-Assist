import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';

export interface VoiceCommandMatch {
  type:
    | 'camera_open'
    | 'camera_close'
    | 'upload_image'
    | 'read_text'
    | 'detect_object'
    | 'what_see'
    | 'what_front'
    | 'what_left'
    | 'what_right'
    | 'distance_query'
    | 'recognize_face'
    | 'detect_currency'
    | 'read_medicine'
    | 'open_navigation'
    | 'sos_trigger'
    | 'sos_cancel'
    | 'call_contact'
    | 'flashlight_on'
    | 'flashlight_off'
    | 'change_language'
    | 'general_question';
  targetContact?: string;
  targetObject?: string;
  targetLanguage?: SupportedLanguage;
  rawTranscript: string;
}

export class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private currentLanguage: SupportedLanguage = 'en';
  private autoRestart = true;
  private onCommandCallback: ((command: VoiceCommandMatch) => void) | null = null;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onListeningStateChange: ((listening: boolean) => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === this.currentLanguage);
    recognition.lang = langObj ? langObj.speechCode : 'en-US';

    recognition.onstart = () => {
      this.isListening = true;
      this.onListeningStateChange?.(true);
    };

    recognition.onend = () => {
      this.isListening = false;
      this.onListeningStateChange?.(false);
      // Auto restart to maintain voice-first hands-free continuous loop
      if (this.autoRestart) {
        setTimeout(() => {
          try {
            if (this.autoRestart && !this.isListening) {
              this.recognition?.start();
            }
          } catch (e) {
            // Can happen if already running
          }
        }, 500);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.autoRestart = false;
        this.onErrorCallback?.('Microphone permission required for voice commands.');
      }
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += piece;
        } else {
          interimTranscript += piece;
        }
      }

      if (interimTranscript) {
        this.onTranscriptCallback?.(interimTranscript, false);
      }

      if (finalTranscript) {
        const clean = finalTranscript.trim();
        this.onTranscriptCallback?.(clean, true);
        const match = this.parseCommand(clean);
        this.onCommandCallback?.(match);
      }
    };

    this.recognition = recognition;
  }

  public setLanguage(lang: SupportedLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      const wasListening = this.isListening;
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
      this.recognition.lang = langObj ? langObj.speechCode : 'en-US';
      if (wasListening) {
        this.stop();
        setTimeout(() => this.start(), 300);
      }
    }
  }

  public start() {
    this.autoRestart = true;
    if (!this.recognition) {
      this.initRecognition();
    }
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition start exception:', e);
      }
    }
  }

  public stop() {
    this.autoRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
  }

  public onCommand(cb: (command: VoiceCommandMatch) => void) {
    this.onCommandCallback = cb;
  }

  public onTranscript(cb: (transcript: string, isFinal: boolean) => void) {
    this.onTranscriptCallback = cb;
  }

  public onError(cb: (error: string) => void) {
    this.onErrorCallback = cb;
  }

  public onStateChange(cb: (listening: boolean) => void) {
    this.onListeningStateChange = cb;
  }

  public getIsListening() {
    return this.isListening;
  }

  /**
   * Parses natural language speech into assistive commands
   */
  public parseCommand(rawText: string): VoiceCommandMatch {
    const text = rawText.toLowerCase().trim();

    // 1. Emergency SOS commands (High Priority)
    if (
      text.includes('cancel sos') ||
      text.includes('stop sos') ||
      text.includes('cancel emergency')
    ) {
      return { type: 'sos_cancel', rawTranscript: rawText };
    }
    if (
      text === 'sos' ||
      text.includes('emergency') ||
      text.includes('help me') ||
      text.includes('காப்பாத்து') || // Tamil: save me
      text.includes('मदद') || // Hindi: help
      text.includes('సహాయం') // Telugu: help
    ) {
      return { type: 'sos_trigger', rawTranscript: rawText };
    }

    // Call contact (e.g. "Call Mom", "Call Dad", "Call John")
    const callMatch = text.match(/(?:call|phone|ring)\s+([a-zA-Z0-9\s]+)/i);
    if (callMatch && !text.includes('cancel')) {
      const contactTarget = callMatch[1].trim();
      return {
        type: 'call_contact',
        targetContact: contactTarget,
        rawTranscript: rawText,
      };
    }

    // 2. Camera Controls
    if (text.includes('open camera') || text.includes('start camera') || text.includes('turn on camera')) {
      return { type: 'camera_open', rawTranscript: rawText };
    }
    if (text.includes('close camera') || text.includes('stop camera') || text.includes('pause camera')) {
      return { type: 'camera_close', rawTranscript: rawText };
    }

    // 3. Upload Image
    if (text.includes('upload image') || text.includes('open image') || text.includes('choose image')) {
      return { type: 'upload_image', rawTranscript: rawText };
    }

    // 4. Flashlight / Torch
    if (text.includes('flashlight on') || text.includes('turn on light') || text.includes('light on')) {
      return { type: 'flashlight_on', rawTranscript: rawText };
    }
    if (text.includes('flashlight off') || text.includes('turn off light') || text.includes('light off')) {
      return { type: 'flashlight_off', rawTranscript: rawText };
    }

    // 5. Read Text / OCR
    if (
      text.includes('read text') ||
      text.includes('read this') ||
      text.includes('read label') ||
      text.includes('read sign') ||
      text.includes('read document') ||
      text.includes('படி') || // Tamil: read
      text.includes('पढ़ो') || // Hindi: read
      text.includes('చదువు') // Telugu: read
    ) {
      return { type: 'read_text', rawTranscript: rawText };
    }

    // 6. Currency Detection
    if (
      text.includes('detect currency') ||
      text.includes('currency') ||
      text.includes('count money') ||
      text.includes('how much money') ||
      text.includes('money') ||
      text.includes('ரூபாய்') || // Tamil: rupee
      text.includes('रुपये') // Hindi: rupees
    ) {
      return { type: 'detect_currency', rawTranscript: rawText };
    }

    // 7. Medicine Detection
    if (
      text.includes('read medicine') ||
      text.includes('medicine') ||
      text.includes('tablet') ||
      text.includes('expiry') ||
      text.includes('மருந்து') || // Tamil
      text.includes('दवा') // Hindi
    ) {
      return { type: 'read_medicine', rawTranscript: rawText };
    }

    // 8. Face Recognition
    if (
      text.includes('recognize face') ||
      text.includes('who is this') ||
      text.includes('who is in front') ||
      text.includes('who is that') ||
      text.includes('identify person')
    ) {
      return { type: 'recognize_face', rawTranscript: rawText };
    }

    // 9. Navigation / GPS
    if (
      text.includes('open navigation') ||
      text.includes('navigation') ||
      text.includes('where am i') ||
      text.includes('my location') ||
      text.includes('route guidance') ||
      text.includes('directions')
    ) {
      return { type: 'open_navigation', rawTranscript: rawText };
    }

    // 10. Directional & Positional Queries
    if (text.includes('what is in front') || text.includes('what is ahead') || text.includes('in front of me')) {
      return { type: 'what_front', rawTranscript: rawText };
    }
    if (text.includes('what is on my left') || text.includes('on the left') || text.includes('to my left')) {
      return { type: 'what_left', rawTranscript: rawText };
    }
    if (text.includes('what is on my right') || text.includes('on the right') || text.includes('to my right')) {
      return { type: 'what_right', rawTranscript: rawText };
    }
    if (text.includes('how far') || text.includes('distance to') || text.includes('how close')) {
      return { type: 'distance_query', rawTranscript: rawText };
    }
    if (
      text.includes('what do you see') ||
      text.includes('describe scene') ||
      text.includes('describe surroundings') ||
      text.includes('what is around')
    ) {
      return { type: 'what_see', rawTranscript: rawText };
    }
    if (text.includes('detect object') || text.includes('find objects')) {
      return { type: 'detect_object', rawTranscript: rawText };
    }

    // 11. Language change commands
    if (text.includes('tamil') || text.includes('தமிழ்')) {
      return { type: 'change_language', targetLanguage: 'ta', rawTranscript: rawText };
    }
    if (text.includes('hindi') || text.includes('हिंदी')) {
      return { type: 'change_language', targetLanguage: 'hi', rawTranscript: rawText };
    }
    if (text.includes('malayalam') || text.includes('മലയാളം')) {
      return { type: 'change_language', targetLanguage: 'ml', rawTranscript: rawText };
    }
    if (text.includes('telugu') || text.includes('తెలుగు')) {
      return { type: 'change_language', targetLanguage: 'te', rawTranscript: rawText };
    }
    if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) {
      return { type: 'change_language', targetLanguage: 'kn', rawTranscript: rawText };
    }
    if (text.includes('english')) {
      return { type: 'change_language', targetLanguage: 'en', rawTranscript: rawText };
    }

    // 12. General contextual question about the current view
    return { type: 'general_question', rawTranscript: rawText };
  }
}

export const voiceRecognition = new VoiceRecognitionService();
