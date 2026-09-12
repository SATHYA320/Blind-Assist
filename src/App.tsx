/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CameraView,
} from './components/CameraView';
import {
  VoiceStatusOverlay,
} from './components/VoiceStatusOverlay';
import {
  AccessibleControls,
} from './components/AccessibleControls';
import {
  SOSModal,
} from './components/SOSModal';
import {
  FaceManagerModal,
} from './components/FaceManagerModal';
import {
  ImageUploadModal,
} from './components/ImageUploadModal';
import {
  NavigationPanel,
} from './components/NavigationPanel';
import {
  SupportedLanguage,
  VisionAnalysisResult,
  DetectedObject,
  EmergencyContact,
  RegisteredFace,
  AssistantMode,
  SUPPORTED_LANGUAGES,
} from './types';
import { speechService } from './services/speechSynthesis';
import { voiceRecognition, VoiceCommandMatch } from './services/voiceRecognition';
import { deviceSensors, LocationData } from './services/deviceSensors';
import { audioHaptics } from './services/audioHaptics';
import { voiceAuthService } from './services/voiceAuth';
import { Shield, Eye, Info, Volume2 } from 'lucide-react';

const STORAGE_KEY_CONTACTS = 'ai_vision_contacts';
const STORAGE_KEY_FACES = 'ai_vision_faces';
const STORAGE_KEY_LANG = 'ai_vision_language';

export default function App() {
  // Video element ref
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Core State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoLoopActive, setAutoLoopActive] = useState(true);

  // Vision Analysis State
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [routeGuidance, setRouteGuidance] = useState<string>(
    'The path ahead appears clear. Continue forward.'
  );
  const [lastAnalysis, setLastAnalysis] = useState<VisionAnalysisResult | null>(null);

  // Voice & Multilingual State
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(() => {
    return (localStorage.getItem(STORAGE_KEY_LANG) as SupportedLanguage) || 'en';
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [wakeWordDetected, setWakeWordDetected] = useState(false);
  const [isVoiceVerified, setIsVoiceVerified] = useState(true);
  const [voiceAuthStatusText, setVoiceAuthStatusText] = useState('Voice Verified');

  // Device & Sensor State
  const [isLowLight, setIsLowLight] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  // Emergency SOS State
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Mom', phone: '+1234567890', relationship: 'Mother' },
        { id: '2', name: 'Dad', phone: '+1987654321', relationship: 'Father' },
      ];
    } catch {
      return [];
    }
  });

  // Face Recognition State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FACES);
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Mom', relationship: 'Mother', descriptionNotes: 'wears glasses, gentle smile', createdAt: Date.now() }
      ];
    } catch {
      return [];
    }
  });

  // Upload & Navigation Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNavModalOpen, setIsNavModalOpen] = useState(false);

  // Deduplication & concurrency trackers
  const lastAnnouncedSummaryRef = useRef<string>('');
  const isStartingCameraRef = useRef(false);
  const isMountedRef = useRef(true);
  const busyCooldownUntilRef = useRef<number>(0);

  // 1. Initial Setup: Camera Auto-Startup & Voice Initialization
  useEffect(() => {
    // Save contacts & faces updates
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FACES, JSON.stringify(registeredFaces));
  }, [registeredFaces]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANG, activeLanguage);
    voiceRecognition.setLanguage(activeLanguage);
  }, [activeLanguage]);

  // Subscribe to Speech Synthesis events
  useEffect(() => {
    const unsub = speechService.subscribe((speaking, text) => {
      setIsSpeaking(speaking);
      if (text) setLastSpokenText(text);
    });
    return () => unsub();
  }, []);

  // Low Light change callback
  useEffect(() => {
    deviceSensors.onLowLightChange((isDark, torchOn) => {
      setIsLowLight(isDark);
      setIsTorchOn(torchOn);
      if (isDark) {
        audioHaptics.playLowLightAlert();
        speechService.speak(
          'Low light detected. Flashlight turned on.',
          activeLanguage,
          'normal'
        );
      } else {
        speechService.speak(
          'Lighting is sufficient. Flashlight turned off.',
          activeLanguage,
          'normal'
        );
      }
    });
  }, [activeLanguage]);

  // Helper to vocalize text
  const speakAssistant = useCallback(
    async (
      text: string,
      priority: 'high' | 'normal' | 'low' = 'normal',
      force = false,
      targetLang?: SupportedLanguage
    ) => {
      const langToUse = targetLang || activeLanguage;
      setLastSpokenText(text);
      await speechService.speak(text, langToUse, priority, force);
    },
    [activeLanguage]
  );

  // Initialize Speech Recognition & Voice Auth listeners
  useEffect(() => {
    // Warm up voice authentication engine
    voiceAuthService.initAudioEngine().catch((e) => console.warn('Voice auth engine:', e));

    voiceRecognition.onStateChange((listening) => {
      setIsListening(listening);
    });

    voiceRecognition.onTranscript((text, _isFinal, hasWake) => {
      setTranscript(text);
      if (hasWake) {
        setWakeWordDetected(true);
      }
    });

    voiceRecognition.onWakeWord((detected) => {
      setWakeWordDetected(detected);
    });

    voiceRecognition.onCommand((cmd) => {
      handleVoiceCommand(cmd);
    });

    voiceRecognition.onError((err) => {
      console.warn('Voice recognition error:', err);
    });

    // Start voice listener automatically
    voiceRecognition.start();

    return () => {
      voiceRecognition.stop();
    };
  }, [activeLanguage, contacts, registeredFaces]);

  // 2. Start Camera Automatically on App Mount
  const startCameraAuto = useCallback(async () => {
    if (!videoRef.current || isStartingCameraRef.current) return;
    if (deviceSensors.isCameraRunning()) {
      setIsCameraActive(true);
      return;
    }

    isStartingCameraRef.current = true;
    setCameraError(null);
    try {
      await deviceSensors.startCamera(videoRef.current);
      if (!isMountedRef.current) {
        deviceSensors.stopCamera();
        return;
      }
      setIsCameraActive(true);
      audioHaptics.playSuccess();
      if (deviceSensors.isUsingSyntheticStream()) {
        setCameraError('Hardware camera is in use by another tab or system application. Standby video mode active. Tap "Start Camera Now" after closing other camera apps.');
        speakAssistant(
          'Hardware camera is currently busy in another tab. Standby vision mode active. Voice controls are listening.',
          'normal',
          true
        );
      } else {
        speakAssistant(
          'Camera started. AI Smart Vision Assistant is active and listening.',
          'normal',
          true
        );
      }
    } catch (err: any) {
      console.warn('Camera startup note:', err);
      const isDeviceInUse =
        err?.name === 'NotReadableError' ||
        err?.name === 'TrackStartError' ||
        /in use|busy|exclusive|concurrent/i.test(err?.message || '');
      const userMessage = isDeviceInUse
        ? 'Camera is currently in use by another application or browser tab. Please close other camera tabs and tap "Start Camera Now".'
        : 'Camera permission was denied or camera is unavailable. Click Start Camera to retry.';
      setCameraError(userMessage);
      speakAssistant(
        isDeviceInUse
          ? 'Camera device is in use by another tab. Please close other camera tabs.'
          : 'Camera is unavailable. Please grant camera permission.',
        'high',
        true
      );
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [speakAssistant]);

  useEffect(() => {
    isMountedRef.current = true;
    startCameraAuto();
    return () => {
      isMountedRef.current = false;
      deviceSensors.stopCamera();
    };
  }, [startCameraAuto]);

  // Fetch initial GPS coordinates quietly
  useEffect(() => {
    deviceSensors
      .getCurrentLocation()
      .then((loc) => setCurrentLocation(loc))
      .catch((e) => console.warn('Initial GPS query:', e));
  }, []);

  // 3. Multimodal Analysis Core Engine
  const analyzeCurrentFrame = useCallback(
    async (
      mode: AssistantMode = 'auto',
      customQuestion?: string,
      targetLanguage?: SupportedLanguage
    ) => {
      if (!videoRef.current || isAnalyzing) return null;

      const langToUse = targetLanguage || activeLanguage;
      const frameBase64 = deviceSensors.captureFrame(videoRef.current);
      if (!frameBase64) return null;

      setIsAnalyzing(true);
      try {
        const response = await fetch('/api/analyze-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: frameBase64,
            mode,
            question: customQuestion,
            language: langToUse,
            registeredFaces: registeredFaces.map((f) => ({
              name: f.name,
              relationship: f.relationship,
              descriptionNotes: f.descriptionNotes,
            })),
          }),
        });

        if (!response.ok) {
          console.warn(`Frame analysis API responded with status ${response.status}`);
          busyCooldownUntilRef.current = Date.now() + 6000;
          return null;
        }

        const data: VisionAnalysisResult = await response.json();
        setLastAnalysis(data);

        // Content Safety Filter Triggered:
        // "If a restricted/nude image is detected, the system must immediately stop processing the image and respond only: 'An error occurred.'"
        if (data.isSensitive) {
          setDetectedObjects([]);
          setObstacles([]);
          setRouteGuidance('');
          speakAssistant('An error occurred.', 'high', true, langToUse);
          return data;
        }

        // Temporary AI model high-demand backoff
        if (data.isTemporaryUnavailable) {
          busyCooldownUntilRef.current = Date.now() + 8000;
          if (customQuestion || mode !== 'auto') {
            speakAssistant(data.speech || 'Vision service is momentarily busy.', 'normal', true, langToUse);
          }
          return data;
        }

        // Update Detected Objects
        if (data.detectedObjects) {
          setDetectedObjects(data.detectedObjects);
        }

        // Update Obstacles & Route Guidance
        if (data.obstacles && data.obstacles.length > 0) {
          setObstacles(data.obstacles);
          audioHaptics.playObstacleWarning();
          speakAssistant(data.speech, 'high', true, langToUse);
        } else {
          setObstacles([]);
          if (data.routeGuidance) {
            setRouteGuidance(data.routeGuidance);
          }

          // Vocalize response if direct question or significant change
          if (customQuestion || mode !== 'auto') {
            audioHaptics.playDetectionPing();
            speakAssistant(data.speech, 'normal', true, langToUse);
          } else if (data.speech && data.speech !== lastAnnouncedSummaryRef.current) {
            lastAnnouncedSummaryRef.current = data.speech;
            audioHaptics.playDetectionPing();
            speakAssistant(data.speech, 'normal', false, langToUse);
          }
        }

        return data;
      } catch (err: any) {
        console.warn('Frame analysis cycle issue:', err?.message || err);
        // Do not crash loop; back off quietly for routine frames
        if (customQuestion || mode !== 'auto') {
          speakAssistant('An error occurred.', 'high', true, langToUse);
        }
      } finally {
        setIsAnalyzing(false);
      }
      return null;
    },
    [isAnalyzing, activeLanguage, registeredFaces, speakAssistant]
  );

  // 4. Auto Surveillance Loop (~6.5 seconds interval for quota efficiency and low battery consumption)
  useEffect(() => {
    if (!isCameraActive || !autoLoopActive) return;

    const interval = setInterval(() => {
      // Only run if not currently speaking or analyzing, and after any temporary cooldown
      if (!isAnalyzing && !isSpeaking && Date.now() > busyCooldownUntilRef.current) {
        analyzeCurrentFrame('auto');
      }
    }, 6500);

    return () => clearInterval(interval);
  }, [isCameraActive, autoLoopActive, isAnalyzing, isSpeaking, analyzeCurrentFrame]);

  // 5. Emergency SOS Trigger & Handling
  const triggerEmergencySOS = useCallback(async () => {
    setIsSOSActive(true);
    setIsSOSModalOpen(true);
    audioHaptics.playSOSSiren();

    // Acquire latest GPS coordinates
    let loc = currentLocation;
    try {
      loc = await deviceSensors.getCurrentLocation();
      setCurrentLocation(loc);
    } catch (e) {
      console.warn('GPS SOS error:', e);
    }

    const mapLink = loc?.mapUrl || 'https://maps.google.com';
    const sosSpeech = `Emergency alert activated. Location has been detected. Contacting emergency contacts now. Current map link is available.`;

    speakAssistant(sosSpeech, 'high', true);

    // Continuous location tracking during SOS
    deviceSensors.startLocationTracking((updatedLoc) => {
      setCurrentLocation(updatedLoc);
    });

    // Auto trigger first registered contact call where allowed
    if (contacts.length > 0 && contacts[0].phone) {
      setTimeout(() => {
        window.location.href = `tel:${contacts[0].phone}`;
      }, 2000);
    }
  }, [currentLocation, contacts, speakAssistant]);

  const cancelEmergencySOS = useCallback(() => {
    setIsSOSActive(false);
    deviceSensors.stopLocationTracking();
    audioHaptics.playSuccess();
    speakAssistant('Emergency SOS has been cancelled.', 'high', true);
  }, [speakAssistant]);

  // 6. Direct Contact Calling
  const callContactByName = useCallback(
    (targetName: string) => {
      const contact = contacts.find((c) =>
        c.name.toLowerCase().includes(targetName.toLowerCase()) ||
        c.relationship.toLowerCase().includes(targetName.toLowerCase())
      );

      if (contact && contact.phone) {
        speakAssistant(`Calling ${contact.name}.`, 'high', true);
        audioHaptics.playSuccess();
        setTimeout(() => {
          window.location.href = `tel:${contact.phone}`;
        }, 1200);
      } else {
        speakAssistant(
          `Could not find ${targetName} in your registered emergency contacts.`,
          'normal',
          true
        );
      }
    },
    [contacts, speakAssistant]
  );

  // Voice enrollment calibration helper
  const handleEnrollVoice = useCallback(async () => {
    try {
      speakAssistant('Please speak now to record your authorized voice signature.', 'high', true);
      const enrolled = await voiceAuthService.enrollVoice('Authorized User');
      if (enrolled) {
        setIsVoiceVerified(true);
        setVoiceAuthStatusText('Voice Verified (Active)');
        audioHaptics.playSuccess();
        speakAssistant('Authorized voice signature calibrated successfully.', 'high', true);
      }
    } catch (e: any) {
      console.warn('Enrollment error:', e);
      speakAssistant('Voice calibration failed. Microphone access is needed.', 'normal', true);
    }
  }, [speakAssistant]);

  // 7. Voice Command Dispatcher with Speaker Verification & Dynamic Language Alignment
  const handleVoiceCommand = useCallback(
    async (cmd: VoiceCommandMatch) => {
      audioHaptics.playListeningStop();

      // Enforce Authorized User Voice Identification when "Aira" wake-word is used
      // (Emergency SOS commands are always permitted for immediate user safety)
      if (cmd.type !== 'sos_trigger' && cmd.type !== 'sos_cancel') {
        const verification = await voiceAuthService.verifySpeaker();
        if (!verification.authorized) {
          setIsVoiceVerified(false);
          setVoiceAuthStatusText('Unauthorized Voice');
          audioHaptics.playLowLightAlert();
          speakAssistant(
            'Voice not recognized. Only the authorized user can command Aira.',
            'high',
            true
          );
          return;
        } else {
          setIsVoiceVerified(true);
          setVoiceAuthStatusText(`Authorized (${Math.round(verification.confidence * 100)}%)`);
        }
      }

      // Determine Target Language from user speech:
      // "The assistant must respond to the user’s questions in the same language the user speaks."
      const queryLang = cmd.targetLanguage || activeLanguage;

      switch (cmd.type) {
        case 'sos_trigger':
          triggerEmergencySOS();
          break;

        case 'sos_cancel':
          cancelEmergencySOS();
          break;

        case 'call_contact':
          if (cmd.targetContact) {
            callContactByName(cmd.targetContact);
          }
          break;

        case 'camera_open':
          startCameraAuto();
          break;

        case 'camera_close':
          deviceSensors.stopCamera();
          setIsCameraActive(false);
          speakAssistant('Camera closed.', 'normal', true, queryLang);
          break;

        case 'upload_image':
          setIsUploadModalOpen(true);
          speakAssistant('Opening image upload.', 'normal', true, queryLang);
          break;

        case 'flashlight_on':
          deviceSensors.setTorch(true);
          setIsTorchOn(true);
          speakAssistant('Flashlight turned on.', 'normal', true, queryLang);
          break;

        case 'flashlight_off':
          deviceSensors.setTorch(false);
          setIsTorchOn(false);
          speakAssistant('Flashlight turned off.', 'normal', true, queryLang);
          break;

        case 'read_text':
          speakAssistant('Reading visible text...', 'normal', true, queryLang);
          analyzeCurrentFrame('ocr', 'Read all visible text on signs, labels, packages, or books.', queryLang);
          break;

        case 'detect_currency':
          speakAssistant('Checking for currency banknotes...', 'normal', true, queryLang);
          analyzeCurrentFrame('currency', 'Identify currency notes and calculate the total amount in rupees.', queryLang);
          break;

        case 'read_medicine':
          speakAssistant('Checking medicine package...', 'normal', true, queryLang);
          analyzeCurrentFrame('medicine', 'Read the medicine name, active ingredients, and expiry date.', queryLang);
          break;

        case 'recognize_face':
          speakAssistant('Scanning for familiar people...', 'normal', true, queryLang);
          analyzeCurrentFrame('faces', 'Who is in front of me? Check against registered contacts.', queryLang);
          break;

        case 'open_navigation':
          setIsNavModalOpen(true);
          deviceSensors
            .getCurrentLocation()
            .then((loc) => {
              setCurrentLocation(loc);
              speakAssistant(
                `Your current location has been detected at ${loc.addressSummary}. Route guidance is active.`,
                'normal',
                true,
                queryLang
              );
            })
            .catch(() => {
              speakAssistant('Location is currently unavailable. Please enable GPS.', 'normal', true, queryLang);
            });
          break;

        case 'what_see':
          analyzeCurrentFrame('auto', 'What do you see in front of me and around me?', queryLang);
          break;

        case 'what_front':
          analyzeCurrentFrame('objects', 'What is directly in front of me?', queryLang);
          break;

        case 'what_left':
          analyzeCurrentFrame('objects', 'What is on my left side?', queryLang);
          break;

        case 'what_right':
          analyzeCurrentFrame('objects', 'What is on my right side?', queryLang);
          break;

        case 'distance_query':
          analyzeCurrentFrame('objects', cmd.rawTranscript, queryLang);
          break;

        case 'detect_object':
          analyzeCurrentFrame('objects', 'Detect and list all recognizable objects in the surroundings.', queryLang);
          break;

        case 'change_language':
          if (cmd.targetLanguage) {
            setActiveLanguage(cmd.targetLanguage);
            const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === cmd.targetLanguage);
            speakAssistant(
              `Language changed to ${langObj?.nativeName || cmd.targetLanguage}.`,
              'normal',
              true,
              cmd.targetLanguage
            );
          }
          break;

        case 'general_question':
        default:
          analyzeCurrentFrame('qa', cmd.rawTranscript, queryLang);
          break;
      }
    },
    [
      triggerEmergencySOS,
      cancelEmergencySOS,
      callContactByName,
      startCameraAuto,
      analyzeCurrentFrame,
      speakAssistant,
      activeLanguage,
    ]
  );

  // Toggle Torch button
  const handleToggleTorch = async () => {
    const nextState = !isTorchOn;
    await deviceSensors.setTorch(nextState);
    setIsTorchOn(nextState);
    speakAssistant(
      nextState ? 'Flashlight on.' : 'Flashlight off.',
      'normal',
      true
    );
  };

  // Toggle Mic button
  const handleToggleMic = () => {
    if (isListening) {
      voiceRecognition.stop();
      audioHaptics.playListeningStop();
    } else {
      voiceRecognition.start();
      audioHaptics.playListeningStart();
    }
  };

  // Upload image analyzer pipeline
  const handleAnalyzeUploadedImage = async (
    base64Data: string,
    mode: string
  ): Promise<VisionAnalysisResult | null> => {
    try {
      const response = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mode,
          language: activeLanguage,
          registeredFaces: registeredFaces.map((f) => ({
            name: f.name,
            relationship: f.relationship,
            descriptionNotes: f.descriptionNotes,
          })),
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');
      return await response.json();
    } catch (err) {
      console.error('Upload analysis error:', err);
      throw err;
    }
  };

  // Snapshot face helper
  const handleCaptureFaceSnapshot = () => {
    if (videoRef.current) {
      return deviceSensors.captureFrame(videoRef.current, 600);
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 font-sans antialiased selection:bg-amber-400 selection:text-neutral-950">
      <main className="w-full max-w-4xl flex flex-col gap-4">
        {/* Top Branding Banner (High Contrast, Accessible, Minimalist) */}
        <header className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center text-neutral-950 font-black shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                AI Smart Vision Assistant
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full">
                  Voice-First
                </span>
              </h1>
              <p className="text-xs text-neutral-400">
                Assistive Real-Time Vision • Obstacle Warnings • Emergency SOS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              speakAssistant(
                'AI Smart Vision Assistant is active. You can speak commands like What do you see, Read Text, Count Money, Check Medicine, Open Navigation, or SOS anytime.',
                'high',
                true
              )
            }
            className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-xl border border-neutral-700 transition-colors"
            title="Read application status instructions"
            aria-label="Read application status instructions aloud"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </header>

        {/* 1. Camera View Screen */}
        <CameraView
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          cameraError={cameraError}
          detectedObjects={detectedObjects}
          obstacles={obstacles}
          routeGuidance={routeGuidance}
          isLowLight={isLowLight}
          isTorchOn={isTorchOn}
          onToggleTorch={handleToggleTorch}
          onRetryCamera={startCameraAuto}
          isAnalyzing={isAnalyzing}
        />

        {/* 2. Voice-First Interaction HUD */}
        <VoiceStatusOverlay
          isListening={isListening}
          isSpeaking={isSpeaking}
          isAnalyzing={isAnalyzing}
          transcript={transcript}
          lastSpokenText={lastSpokenText}
          activeLanguage={activeLanguage}
          wakeWordDetected={wakeWordDetected}
          isVoiceVerified={isVoiceVerified}
          voiceAuthStatusText={voiceAuthStatusText}
          onLanguageChange={(lang) => {
            setActiveLanguage(lang);
            const l = SUPPORTED_LANGUAGES.find((item) => item.code === lang);
            speakAssistant(`Language switched to ${l?.nativeName || lang}.`, 'normal', true, lang);
          }}
          onToggleMic={handleToggleMic}
          onEnrollVoice={handleEnrollVoice}
        />

        {/* 3. Accessible Touch Controls & Feature Triggers */}
        <AccessibleControls
          onTriggerMode={(mode, prompt) => analyzeCurrentFrame(mode, prompt)}
          onOpenSOS={() => setIsSOSModalOpen(true)}
          onOpenFaceManager={() => setIsFaceModalOpen(true)}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onOpenNavigation={() => setIsNavModalOpen(true)}
          isAnalyzing={isAnalyzing}
          autoLoopActive={autoLoopActive}
          onToggleAutoLoop={() => {
            const next = !autoLoopActive;
            setAutoLoopActive(next);
            speakAssistant(
              next ? 'Continuous surveillance active.' : 'Surveillance paused.',
              'normal',
              true
            );
          }}
        />

        {/* Safety & Assistive Disclaimer Footer */}
        <footer className="mt-2 text-center text-xs text-neutral-500 flex items-center justify-center gap-1.5 pb-4">
          <Shield className="w-3.5 h-3.5 text-neutral-400" />
          <span>
            AI Smart Vision Assistant is an assistive visual guide. Distances and route guidance are approximate.
          </span>
        </footer>
      </main>

      {/* Modals & Dialogs */}
      <SOSModal
        isOpen={isSOSModalOpen}
        onClose={() => setIsSOSModalOpen(false)}
        isSOSActive={isSOSActive}
        onCancelSOS={cancelEmergencySOS}
        onTriggerSOS={triggerEmergencySOS}
        contacts={contacts}
        onUpdateContacts={setContacts}
        activeLocation={currentLocation}
      />

      <FaceManagerModal
        isOpen={isFaceModalOpen}
        onClose={() => setIsFaceModalOpen(false)}
        faces={registeredFaces}
        onUpdateFaces={setRegisteredFaces}
        onCaptureFaceSnapshot={handleCaptureFaceSnapshot}
      />

      <ImageUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAnalyzeImage={handleAnalyzeUploadedImage}
        onSpeakText={(text, lang) => speakAssistant(text, 'normal', true)}
        activeLanguage={activeLanguage}
      />

      <NavigationPanel
        isOpen={isNavModalOpen}
        onClose={() => setIsNavModalOpen(false)}
        currentLocation={currentLocation}
        onRefreshLocation={async () => {
          try {
            const loc = await deviceSensors.getCurrentLocation();
            setCurrentLocation(loc);
            speakAssistant(`Location refreshed: ${loc.addressSummary}`, 'normal', true);
          } catch (e) {
            speakAssistant('Unable to retrieve GPS location.', 'normal', true);
          }
        }}
        routeGuidanceText={routeGuidance}
        onSpeakText={(text) => speakAssistant(text, 'normal', true)}
      />
    </div>
  );
}
