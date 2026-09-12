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
  private startCameraPromise: Promise<MediaStream> | null = null;
  private currentVideoElement: HTMLVideoElement | null = null;
  private torchSupported = false;
  private torchActive = false;
  private isLowLight = false;
  private luminanceThreshold = 35; // out of 255
  private lastLuminanceCheck = 0;
  private onLowLightChangeCb: ((isDark: boolean, torchOn: boolean) => void) | null = null;
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private onLocationChangeCb: ((loc: LocationData) => void) | null = null;

  private isSyntheticStream = false;

  isUsingSyntheticStream(): boolean {
    return this.isSyntheticStream;
  }

  isCameraRunning(): boolean {
    if (!this.mediaStream) return false;
    const tracks = this.mediaStream.getVideoTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
  }

  // Helper to create a fallback synthetic video stream so the user interface and vision assistant never crash or freeze
  private createSyntheticVisionStream(): MediaStream {
    this.isSyntheticStream = true;
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    // Animate a clean visual placeholder feed
    let frame = 0;
    const drawPlaceholder = () => {
      frame++;
      // Deep neutral background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Assistive grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Scanner bar
      const scanY = (frame * 3) % canvas.height;
      const grad = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
      grad.addColorStop(0, 'rgba(251, 191, 36, 0)');
      grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.4)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 20, canvas.width, 40);

      // Central visual target
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width / 2 - 120, canvas.height / 2 - 90, 240, 180);

      // Status text
      ctx.fillStyle = '#f3f4f6';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AI Smart Vision • Standby Feed', canvas.width / 2, canvas.height / 2 - 15);

      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('Hardware camera in use by system or another tab.', canvas.width / 2, canvas.height / 2 + 18);
      ctx.fillText('Voice recognition, speech & touch controls active.', canvas.width / 2, canvas.height / 2 + 40);
    };

    drawPlaceholder();
    const intervalId = window.setInterval(drawPlaceholder, 100);

    const stream = canvas.captureStream(15);
    const originalTrack = stream.getVideoTracks()[0];
    if (originalTrack) {
      const origStop = originalTrack.stop.bind(originalTrack);
      originalTrack.stop = () => {
        clearInterval(intervalId);
        origStop();
      };
    }
    return stream;
  }

  // Initialize camera with progressive retries and fallback
  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    // If camera is already streaming and active, reuse existing stream
    if (this.isCameraRunning() && this.mediaStream) {
      this.currentVideoElement = videoElement;
      if (videoElement.srcObject !== this.mediaStream) {
        videoElement.srcObject = this.mediaStream;
        try {
          await videoElement.play();
        } catch (e: any) {
          if (e.name !== 'AbortError') console.warn('Re-attach video play error:', e);
        }
      }
      return this.mediaStream;
    }

    // If a camera start is already in progress, await the existing promise to prevent hardware collision
    if (this.startCameraPromise) {
      return this.startCameraPromise;
    }

    this.startCameraPromise = (async () => {
      try {
        // Release any prior tracks to prevent "Device in use" hardware locking
        this.stopCameraTracks();

        // Brief delay to allow the OS camera hardware to release locks
        await new Promise((resolve) => setTimeout(resolve, 150));

        let stream: MediaStream | null = null;
        let lastError: any = null;

        // Try environment camera first
        const attemptProfiles: MediaStreamConstraints[] = [
          { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          { audio: false, video: { facingMode: 'user' } },
          { audio: false, video: true },
        ];

        for (let i = 0; i < attemptProfiles.length; i++) {
          const constraints = attemptProfiles[i];
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream && stream.getVideoTracks().length > 0) {
              this.isSyntheticStream = false;
              break;
            }
          } catch (err: any) {
            lastError = err;
            const isDeviceInUse =
              err?.name === 'NotReadableError' ||
              err?.name === 'TrackStartError' ||
              /in use|busy|exclusive|concurrent|could not start/i.test(err?.message || '');

            console.warn(`Camera attempt ${i + 1} (${JSON.stringify(constraints.video)}) warning:`, err?.name, err?.message);

            if (isDeviceInUse) {
              // Wait a moment for OS hardware lock to release before trying simpler constraint
              await new Promise((resolve) => setTimeout(resolve, 350));
            }
          }
        }

        // If hardware camera is genuinely locked or unavailable across all attempts, activate clean synthetic feed
        if (!stream) {
          console.warn('Physical camera unavailable or in exclusive use. Initializing assistive video standby feed.');
          stream = this.createSyntheticVisionStream();
        }

        this.mediaStream = stream;
        this.currentVideoElement = videoElement;
        videoElement.srcObject = stream;

        try {
          await videoElement.play();
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.warn('Video play note:', playErr);
          }
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          this.videoTrack = track;
          track.onended = () => {
            this.stopCamera();
          };
          const capabilities: any = track.getCapabilities?.() || {};
          this.torchSupported = !!capabilities.torch;
        }

        return stream;
      } finally {
        this.startCameraPromise = null;
      }
    })();

    return this.startCameraPromise;
  }

  stopCamera() {
    this.stopCameraTracks();
    if (this.currentVideoElement) {
      try {
        this.currentVideoElement.srcObject = null;
      } catch (e) {}
      this.currentVideoElement = null;
    }
  }

  private stopCameraTracks() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
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
