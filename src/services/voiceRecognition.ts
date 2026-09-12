import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';
import { detectSpokenLanguage } from './languageDetector';

export interface VoiceCommandMatch {
  type:
    | 'wake_word_only'
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
    | 'enroll_voice'
    | 'live_conversation'
    | 'general_question';
  targetContact?: string;
  targetObject?: string;
  targetLanguage?: SupportedLanguage;
  detectedLanguage?: SupportedLanguage;
  rawTranscript: string;
  commandText?: string;
  hasWakeWord: boolean;
}

// Multilingual phonetic regex variations for the starting keyword "Aira"
// e.g. "Aira", "Ayra", "Ira", "Eyra", "Era", "ஐரா" (Tamil), "आइरा" (Hindi), "ഐറ" (Malayalam), "ఐరా" (Telugu), "ಐರಾ" (Kannada)
const AIRA_WAKE_REGEX =
  /(?:^|\s|[.,!?;:])(?:aira|ayra|eyra|ira|iera|hey\s+aira|hi\s+aira|ok\s+aira|ஐரா|आइरा|ऐरा|ഐറ|ఐరా|ಐರಾ)(?:\s|[.,!?;:]|$)/i;

export class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;
  private currentLanguage: SupportedLanguage = 'en';
  private autoRestart = true;
  private onCommandCallback: ((command: VoiceCommandMatch) => void) | null = null;
  private onTranscriptCallback: ((transcript: string, isFinal: boolean, hasWakeWord: boolean) => void) | null = null;
  private onWakeWordDetectedCallback: ((detected: boolean) => void) | null = null;
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
      // Auto restart to maintain voice-first continuous listening loop
      if (this.autoRestart) {
        setTimeout(() => {
          try {
            if (this.autoRestart && !this.isListening) {
              this.recognition?.start();
            }
          } catch (e) {
            // Can happen if already running
          }
        }, 400);
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
        const hasWake = this.detectWakeWord(interimTranscript);
        this.onTranscriptCallback?.(interimTranscript, false, hasWake);
        if (hasWake) {
          this.onWakeWordDetectedCallback?.(true);
        }
      }

      if (finalTranscript) {
        const clean = finalTranscript.trim();
        const hasWake = this.detectWakeWord(clean);
        this.onTranscriptCallback?.(clean, true, hasWake);

        const match = this.parseCommand(clean);
        if (match) {
          this.onCommandCallback?.(match);
        }
      }
    };

    this.recognition = recognition;
  }

  /**
   * Checks whether the keyword "Aira" is present in the spoken transcript.
   */
  public detectWakeWord(transcript: string): boolean {
    if (!transcript) return false;
    return AIRA_WAKE_REGEX.test(transcript.trim());
  }

  /**
   * Extracts the actual command payload after stripping the wake-word "Aira".
   */
  public stripWakeWord(transcript: string): string {
    return transcript
      .replace(
        /(?:^|\s|[.,!?;:])(?:aira|ayra|eyra|ira|iera|hey\s+aira|hi\s+aira|ok\s+aira|ஐரா|आइरा|ऐरा|ഐറ|ఐరా|ಐರಾ)(?:\s|[.,!?;:]|$)/gi,
        ' '
      )
      .trim();
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

  public onTranscript(cb: (transcript: string, isFinal: boolean, hasWakeWord: boolean) => void) {
    this.onTranscriptCallback = cb;
  }

  public onWakeWord(cb: (detected: boolean) => void) {
    this.onWakeWordDetectedCallback = cb;
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
   * Parses natural language speech into assistive commands.
   * STRICT ENFORCEMENT: The assistant must only become active when the user says "Aira".
   * If the user does not say "Aira", returns null so the assistant remains idle.
   * EXCEPTION: Critical SOS emergency triggers ("SOS", "Help me") are allowed for life safety.
   */
  public parseCommand(rawText: string): VoiceCommandMatch | null {
    const rawClean = rawText.trim();
    if (!rawClean) return null;

    const lower = rawClean.toLowerCase();
    const hasWake = this.detectWakeWord(rawClean);

    // Life-Safety Check: Urgent SOS can trigger even in crisis
    const isUrgentSOS =
      lower === 'sos' ||
      lower.includes('cancel sos') ||
      lower.includes('stop sos') ||
      lower.includes('help me') ||
      lower.includes('காப்பாத்து') ||
      lower.includes('मदद करो') ||
      lower.includes('సహాయం');

    // Strict User Intent Requirement:
    // "The assistant must only become active when the user says the starting keyword 'Aira'.
    // If the user does not say 'Aira', the assistant must not respond or perform any action."
    if (!hasWake && !isUrgentSOS) {
      return null;
    }

    // Strip "Aira" to isolate the command payload
    const hasWakeWord = hasWake;
    const commandText = this.stripWakeWord(rawClean);
    const text = (commandText || rawClean).toLowerCase().trim();

    // Detect the language used in the command
    const detectedLang = detectSpokenLanguage(rawClean);

    // If user only said "Aira" without following command
    if (!text || text.length === 0) {
      return {
        type: 'wake_word_only',
        rawTranscript: rawClean,
        commandText: '',
        hasWakeWord: true,
        detectedLanguage: detectedLang,
      };
    }

    // 1. Emergency SOS commands
    if (
      text.includes('cancel sos') ||
      text.includes('stop sos') ||
      text.includes('cancel emergency')
    ) {
      return {
        type: 'sos_cancel',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text === 'sos' ||
      text.includes('emergency') ||
      text.includes('help me') ||
      text.includes('காப்பாத்து') || // Tamil: save me
      text.includes('मदद') || // Hindi: help
      text.includes('సహాయం') // Telugu: help
    ) {
      return {
        type: 'sos_trigger',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // Call contact (e.g. "Aira call Mom", "Aira phone John")
    const callMatch = text.match(/(?:call|phone|ring)\s+([a-zA-Z0-9\s]+)/i);
    if (callMatch && !text.includes('cancel')) {
      const contactTarget = callMatch[1].trim();
      return {
        type: 'call_contact',
        targetContact: contactTarget,
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 2. Camera Controls
    if (
      text.includes('open camera') ||
      text.includes('start camera') ||
      text.includes('turn on camera')
    ) {
      return {
        type: 'camera_open',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('close camera') ||
      text.includes('stop camera') ||
      text.includes('pause camera')
    ) {
      return {
        type: 'camera_close',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 3. Upload Image
    if (
      text.includes('upload image') ||
      text.includes('open image') ||
      text.includes('choose image')
    ) {
      return {
        type: 'upload_image',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 4. Flashlight / Torch
    if (
      text.includes('flashlight on') ||
      text.includes('turn on light') ||
      text.includes('light on')
    ) {
      return {
        type: 'flashlight_on',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('flashlight off') ||
      text.includes('turn off light') ||
      text.includes('light off')
    ) {
      return {
        type: 'flashlight_off',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
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
      return {
        type: 'read_text',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
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
      return {
        type: 'detect_currency',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
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
      return {
        type: 'read_medicine',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 8. Face Recognition
    if (
      text.includes('recognize face') ||
      text.includes('who is this') ||
      text.includes('who is in front') ||
      text.includes('who is that') ||
      text.includes('identify person')
    ) {
      return {
        type: 'recognize_face',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
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
      return {
        type: 'open_navigation',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 10. Voice Calibration / Enroll Voice
    if (
      text.includes('enroll voice') ||
      text.includes('calibrate voice') ||
      text.includes('register voice') ||
      text.includes('my voice')
    ) {
      return {
        type: 'enroll_voice',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 11. Directional & Positional Queries
    if (
      text.includes('what is in front') ||
      text.includes('what is ahead') ||
      text.includes('in front of me')
    ) {
      return {
        type: 'what_front',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('what is on my left') ||
      text.includes('on the left') ||
      text.includes('to my left')
    ) {
      return {
        type: 'what_left',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('what is on my right') ||
      text.includes('on the right') ||
      text.includes('to my right')
    ) {
      return {
        type: 'what_right',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('how far') ||
      text.includes('distance to') ||
      text.includes('how close')
    ) {
      return {
        type: 'distance_query',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (
      text.includes('what do you see') ||
      text.includes('describe scene') ||
      text.includes('describe surroundings') ||
      text.includes('what is around')
    ) {
      return {
        type: 'what_see',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }
    if (text.includes('detect object') || text.includes('find objects')) {
      return {
        type: 'detect_object',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 12. Live Voice Conversation (Gemini Live API)
    if (
      text.includes('live conversation') ||
      text.includes('live api') ||
      text.includes('live voice') ||
      text.includes('talk live') ||
      text.includes('start live') ||
      text.includes('have a conversation') ||
      text.includes('voice conversation') ||
      text.includes('real time conversation')
    ) {
      return {
        type: 'live_conversation',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: detectedLang,
      };
    }

    // 13. Language change commands
    if (text.includes('tamil') || text.includes('தமிழ்')) {
      return {
        type: 'change_language',
        targetLanguage: 'ta',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'ta',
      };
    }
    if (text.includes('hindi') || text.includes('हिंदी') || text.includes('हिन्दी')) {
      return {
        type: 'change_language',
        targetLanguage: 'hi',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'hi',
      };
    }
    if (text.includes('malayalam') || text.includes('മലയാളം')) {
      return {
        type: 'change_language',
        targetLanguage: 'ml',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'ml',
      };
    }
    if (text.includes('telugu') || text.includes('తెలుగు')) {
      return {
        type: 'change_language',
        targetLanguage: 'te',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'te',
      };
    }
    if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) {
      return {
        type: 'change_language',
        targetLanguage: 'kn',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'kn',
      };
    }
    if (text.includes('english')) {
      return {
        type: 'change_language',
        targetLanguage: 'en',
        rawTranscript: rawClean,
        commandText,
        hasWakeWord,
        detectedLanguage: 'en',
      };
    }

    // 13. General contextual question directed to Aira
    return {
      type: 'general_question',
      rawTranscript: rawClean,
      commandText,
      hasWakeWord,
      detectedLanguage: detectedLang,
    };
  }
}

export const voiceRecognition = new VoiceRecognitionService();
