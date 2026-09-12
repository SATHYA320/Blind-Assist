export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  mapUrl: string;
  addressSummary?: string;
}

export class DeviceSensorService {
  private mediaStream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private torchSupported = false;
  private torchActive = false;
  private isLowLight = false;
  private luminanceThreshold = 35; // out of 255
  private lastLuminanceCheck = 0;
  private onLowLightChangeCb: ((isDark: boolean, torchOn: boolean) => void) | null = null;
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private onLocationChangeCb: ((loc: LocationData) => void) | null = null;

  // Initialize camera with back-facing environment preference for vision assistance
  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      const track = stream.getVideoTracks()[0];
      if (track) {
        this.videoTrack = track;
        const capabilities: any = track.getCapabilities?.() || {};
        this.torchSupported = !!capabilities.torch;
      }

      return stream;
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      throw err;
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
      this.videoTrack = null;
    }
  }

  // Toggle or set flashlight/torch
  async setTorch(enabled: boolean): Promise<boolean> {
    this.torchActive = enabled;
    if (this.videoTrack && this.torchSupported) {
      try {
        await (this.videoTrack as any).applyConstraints({
          advanced: [{ torch: enabled }],
        });
        return true;
      } catch (err) {
        console.warn('Could not apply torch constraint:', err);
      }
    }
    return false;
  }

  getTorchState(): { supported: boolean; active: boolean } {
    return {
      supported: this.torchSupported,
      active: this.torchActive,
    };
  }

  // Capture current frame from video element as base64 JPEG
  captureFrame(videoElement: HTMLVideoElement, maxWidth = 1024): string | null {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    let width = videoElement.videoWidth;
    let height = videoElement.videoHeight;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, width, height);

    // Also analyze luminance periodically for low-light detection
    this.checkLuminance(ctx, width, height);

    return canvas.toDataURL('image/jpeg', 0.82);
  }

  // Analyze luminance to detect low light
  private checkLuminance(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const now = Date.now();
    if (now - this.lastLuminanceCheck < 2000) return; // Check every 2s
    this.lastLuminanceCheck = now;

    try {
      // Sample down to 32x32 for super fast luminance calculation
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      let totalLuminance = 0;
      let count = 0;
      const step = 8; // sample every 8 pixels

      for (let i = 0; i < data.length; i += 4 * step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Standard relative perceptual luminance formula
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += lum;
        count++;
      }

      const avgLuminance = totalLuminance / (count || 1);
      const isDarkNow = avgLuminance < this.luminanceThreshold;

      if (isDarkNow !== this.isLowLight) {
        this.isLowLight = isDarkNow;
        if (isDarkNow && !this.torchActive && this.torchSupported) {
          this.setTorch(true);
        } else if (!isDarkNow && this.torchActive && this.torchSupported) {
          this.setTorch(false);
        }
        this.onLowLightChangeCb?.(isDarkNow, this.torchActive);
      }
    } catch (e) {
      // Canvas security or pixel read error
    }
  }

  onLowLightChange(cb: (isDark: boolean, torchOn: boolean) => void) {
    this.onLowLightChangeCb = cb;
  }

  getIsLowLight(): boolean {
    return this.isLowLight;
  }

  // Obtain current GPS position
  async getCurrentLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const loc: LocationData = {
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            timestamp: pos.timestamp,
            mapUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
            addressSummary: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`,
          };
          this.currentLocation = loc;
          resolve(loc);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  // Continuously track location (for Emergency SOS tracking)
  startLocationTracking(cb: (loc: LocationData) => void) {
    this.onLocationChangeCb = cb;
    if ('geolocation' in navigator && this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const loc: LocationData = {
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            timestamp: pos.timestamp,
            mapUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
            addressSummary: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`,
          };
          this.currentLocation = loc;
          this.onLocationChangeCb?.(loc);
        },
        (err) => console.warn('Location watch error:', err),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }

  stopLocationTracking() {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getCachedLocation(): LocationData | null {
    return this.currentLocation;
  }
}

export const deviceSensors = new DeviceSensorService();
