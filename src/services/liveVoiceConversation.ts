/**
 * Service to manage real-time voice conversation with Gemini Live API (gemini-3.1-flash-live-preview).
 * Connects over WebSocket to the server proxy at /api/live.
 * - Streams audio from mic downsampled to 16kHz PCM Little-Endian
 * - Plays back 24kHz PCM audio received from Gemini Live
 * - Optionally sends real-time video snapshots (1 FPS) for multimodal visual conversation
 */

export class LiveVoiceService {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micStream: MediaStream | null = null;
  private nextStartTime: number = 0;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private onStatusChangeCb: ((status: string, details?: any) => void) | null = null;
  private onSpeechStateCb: ((isSpeaking: boolean) => void) | null = null;

  constructor() {
    // Lazy initialized
  }

  public setCallbacks(
    onStatusChange: (status: string, details?: any) => void,
    onSpeechState: (isSpeaking: boolean) => void
  ) {
    this.onStatusChangeCb = onStatusChange;
    this.onSpeechStateCb = onSpeechState;
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Start Live API session
   */
  public async startLiveSession(): Promise<boolean> {
    if (this.isConnected || this.isConnecting) return true;
    this.isConnecting = true;
    this.onStatusChangeCb?.('connecting', 'Connecting to Gemini Live API...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('Connected to Live WebSocket');
        this.isConnected = true;
        this.isConnecting = false;
        this.onStatusChangeCb?.('connected', 'Live Conversation Active (gemini-3.1-flash-live-preview)');
        await this.startAudioCapture();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'audio' && msg.audio) {
            this.playPcmAudio(msg.audio);
          } else if (msg.type === 'interrupted') {
            this.handleInterruption();
          } else if (msg.type === 'error') {
            this.onStatusChangeCb?.('error', msg.error || 'Live API error');
          }
        } catch (e) {
          console.warn('Error parsing Live message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        this.onStatusChangeCb?.('error', 'Connection to Live API failed');
        this.stopLiveSession();
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.onStatusChangeCb?.('disconnected', 'Live Conversation Disconnected');
        this.cleanupAudio();
      };

      return true;
    } catch (err: any) {
      console.error('Failed to start Live API session:', err);
      this.isConnecting = false;
      this.isConnected = false;
      this.onStatusChangeCb?.('error', err?.message || 'Failed to start Live Conversation');
      return false;
    }
  }

  /**
   * Send text prompt directly to Live conversation
   */
  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  /**
   * Send video snapshot frame (1 FPS max)
   */
  public sendVideoFrame(base64Jpeg: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'video', video: base64Jpeg }));
    }
  }

  /**
   * End the Live API session
   */
  public stopLiveSession() {
    this.isConnected = false;
    this.isConnecting = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.cleanupAudio();
    this.onStatusChangeCb?.('disconnected', 'Live Conversation Closed');
    this.onSpeechStateCb?.(false);
  }

  private async startAudioCapture() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // 16kHz for mic capture as mandated by Live API
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      // 24kHz for model audio output playback
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.nextStartTime = this.outputAudioCtx.currentTime;

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const source = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      // Process raw audio buffer in 4096 samples chunks
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Base64 = this.float32ToPcm16Base64(inputData);
        this.ws.send(JSON.stringify({ type: 'audio', audio: pcm16Base64 }));
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);
    } catch (err: any) {
      console.warn('Live API audio capture error:', err);
      this.onStatusChangeCb?.('mic_error', 'Microphone capture unavailable or blocked');
    }
  }

  /**
   * Convert Float32 audio channel samples to 16-bit PCM Little Endian base64 string
   */
  private float32ToPcm16Base64(samples: Float32Array): string {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Play 24kHz PCM Little-Endian audio chunk received from Gemini Live API
   */
  private playPcmAudio(base64Pcm: string) {
    if (!this.outputAudioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume();
    }

    try {
      const binaryString = window.atob(base64Pcm);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const sampleCount = Math.floor(len / 2);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const audioBuffer = this.outputAudioCtx.createBuffer(1, sampleCount, 24000);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < sampleCount; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        channelData[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
      }

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputAudioCtx.destination);

      const currentTime = this.outputAudioCtx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      sourceNode.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.onSpeechStateCb?.(true);
      sourceNode.onended = () => {
        if (this.outputAudioCtx && this.outputAudioCtx.currentTime >= this.nextStartTime - 0.05) {
          this.onSpeechStateCb?.(false);
        }
      };
    } catch (e) {
      console.warn('Failed to decode/play PCM audio chunk:', e);
    }
  }

  private handleInterruption() {
    // Interruption from user speech: reset output buffer scheduling
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.onSpeechStateCb?.(false);
  }

  private cleanupAudio() {
    try {
      this.scriptProcessor?.disconnect();
      this.scriptProcessor = null;
      this.micStream?.getTracks().forEach((track) => track.stop());
      this.micStream = null;
      this.inputAudioCtx?.close();
      this.inputAudioCtx = null;
      this.outputAudioCtx?.close();
      this.outputAudioCtx = null;
    } catch (e) {}
  }
}

export const liveVoiceService = new LiveVoiceService();
