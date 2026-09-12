import React, { useRef, useEffect } from 'react';
import { DetectedObject } from '../types';
import { AlertTriangle, Compass, Flashlight, Eye, ShieldAlert, Sparkles } from 'lucide-react';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  cameraError: string | null;
  detectedObjects: DetectedObject[];
  obstacles: string[];
  routeGuidance: string;
  isLowLight: boolean;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  onRetryCamera: () => void;
  isAnalyzing: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  isCameraActive,
  cameraError,
  detectedObjects,
  obstacles,
  routeGuidance,
  isLowLight,
  isTorchOn,
  onToggleTorch,
  onRetryCamera,
  isAnalyzing,
}) => {
  return (
    <div
      id="camera-container"
      className="relative w-full h-[48vh] sm:h-[52vh] md:h-[56vh] bg-neutral-950 rounded-2xl overflow-hidden border-2 border-neutral-800 shadow-2xl flex items-center justify-center"
      aria-label="Live camera view and visual surroundings overlay"
    >
      {/* Live Video Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isCameraActive ? 'opacity-100' : 'opacity-0'
        } ${isLowLight ? 'brightness-110 contrast-115' : ''}`}
        aria-hidden="true"
      />

      {/* Camera Off / Permission State */}
      {!isCameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-neutral-900/90 text-neutral-100">
          <Eye className="w-16 h-16 text-amber-400 mb-4 animate-pulse" />
          <h2 className="text-xl font-bold mb-2">
            {cameraError ? 'Camera Unavailable' : 'Starting Camera Automatically...'}
          </h2>
          <p className="text-sm text-neutral-300 max-w-md mb-4">
            {cameraError
              ? cameraError
              : 'Please grant camera permission to begin real-time voice and visual assistance.'}
          </p>
          <button
            id="retry-camera-btn"
            onClick={onRetryCamera}
            className="px-6 py-3 bg-amber-400 text-neutral-950 font-bold rounded-xl hover:bg-amber-300 active:scale-95 transition-all text-base focus:ring-4 focus:ring-amber-300"
            aria-label="Grant camera permission and start video"
          >
            Start Camera Now
          </button>
        </div>
      )}

      {/* Analysis Scanner Sweep Animation */}
      {isCameraActive && isAnalyzing && (
        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent top-0 animate-[scan_2.5s_ease-in-out_infinite] shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10 pointer-events-none" />
      )}

      {/* Top Overlay Badges: Low Light & Torch */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-2 flex-wrap">
          {isLowLight && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/90 border border-amber-500/60 text-amber-300 text-xs font-semibold rounded-full backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Low Light Mode
            </div>
          )}

          {isAnalyzing && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 text-xs font-semibold rounded-full backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              AI Analyzing Surroundings
            </div>
          )}
        </div>

        <button
          id="torch-toggle-btn"
          type="button"
          onClick={onToggleTorch}
          className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all focus:ring-2 ${
            isTorchOn
              ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
              : 'bg-neutral-900/80 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
          }`}
          aria-label={isTorchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
        >
          <Flashlight className="w-3.5 h-3.5" />
          {isTorchOn ? 'Flashlight ON' : 'Flashlight'}
        </button>
      </div>

      {/* Obstacle Warning Banner (High Priority Alert) */}
      {obstacles && obstacles.length > 0 && (
        <div
          id="obstacle-warning-banner"
          role="alert"
          aria-live="assertive"
          className="absolute top-14 left-3 right-3 p-3 bg-red-600 text-white rounded-xl border-2 border-red-300 shadow-xl flex items-center gap-3 z-30 animate-bounce"
        >
          <AlertTriangle className="w-7 h-7 flex-shrink-0 text-amber-200" />
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-sm sm:text-base leading-tight">
              OBSTACLE AHEAD!
            </p>
            <p className="text-xs sm:text-sm font-medium text-red-100 truncate">
              {obstacles.join(' • ')}
            </p>
          </div>
        </div>
      )}

      {/* Visual Bounding & Positional Badges */}
      {isCameraActive && detectedObjects.length > 0 && (
        <div className="absolute inset-0 pointer-events-none p-3 z-10 flex flex-col justify-end">
          {/* Spatial Distribution Chips (Left, Center, Right) */}
          <div className="flex items-end justify-between gap-2 mb-16 overflow-hidden">
            {/* Left Zone */}
            <div className="flex flex-col gap-1.5 items-start max-w-[32%]">
              {detectedObjects
                .filter((o) => o.position === 'left')
                .slice(0, 2)
                .map((obj) => (
                  <div
                    key={obj.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border backdrop-blur-md shadow-lg ${
                      obj.isObstacle
                        ? 'bg-red-950/90 text-red-200 border-red-500'
                        : 'bg-neutral-900/90 text-neutral-100 border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>LEFT:</span>
                      <span className="text-amber-400 capitalize">{obj.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-300 font-normal">
                      {obj.color ? `${obj.color} • ` : ''}
                      {obj.distanceMeters ? `~${obj.distanceMeters}m` : 'ahead'}
                    </div>
                    {obj.isUnknown && obj.unknownDetails && (
                      <div className="text-[9px] text-cyan-300 italic">
                        {obj.unknownDetails.shape || 'Unknown'} ({obj.unknownDetails.texture || 'smooth'})
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Center / Front Zone */}
            <div className="flex flex-col gap-1.5 items-center max-w-[34%]">
              {detectedObjects
                .filter((o) => o.position === 'center')
                .slice(0, 2)
                .map((obj) => (
                  <div
                    key={obj.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border text-center backdrop-blur-md shadow-lg ${
                      obj.isObstacle
                        ? 'bg-red-950/90 text-red-200 border-red-500 animate-pulse'
                        : 'bg-amber-950/90 text-amber-200 border-amber-500'
                    }`}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      <span>FRONT:</span>
                      <span className="text-white capitalize">{obj.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-300 font-normal">
                      {obj.color ? `${obj.color} • ` : ''}
                      {obj.distanceMeters ? `~${obj.distanceMeters}m` : 'ahead'}
                    </div>
                    {obj.isUnknown && obj.unknownDetails && (
                      <div className="text-[9px] text-cyan-300 italic">
                        {obj.unknownDetails.shape}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Right Zone */}
            <div className="flex flex-col gap-1.5 items-end max-w-[32%]">
              {detectedObjects
                .filter((o) => o.position === 'right')
                .slice(0, 2)
                .map((obj) => (
                  <div
                    key={obj.id}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border text-right backdrop-blur-md shadow-lg ${
                      obj.isObstacle
                        ? 'bg-red-950/90 text-red-200 border-red-500'
                        : 'bg-neutral-900/90 text-neutral-100 border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1 justify-end">
                      <span>RIGHT:</span>
                      <span className="text-amber-400 capitalize">{obj.name}</span>
                    </div>
                    <div className="text-[10px] text-neutral-300 font-normal">
                      {obj.color ? `${obj.color} • ` : ''}
                      {obj.distanceMeters ? `~${obj.distanceMeters}m` : 'ahead'}
                    </div>
                    {obj.isUnknown && obj.unknownDetails && (
                      <div className="text-[9px] text-cyan-300 italic">
                        {obj.unknownDetails.shape}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Route Guidance Pill */}
      {routeGuidance && (
        <div
          id="route-guidance-bar"
          className="absolute bottom-2 left-3 right-3 px-4 py-2 bg-neutral-950/95 border border-cyan-500/50 rounded-xl backdrop-blur-md flex items-center gap-2.5 z-20 shadow-lg text-cyan-200"
        >
          <Compass className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-semibold truncate">
            {routeGuidance}
          </p>
        </div>
      )}
    </div>
  );
};
