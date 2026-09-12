import React from 'react';
import {
  Eye,
  FileText,
  Banknote,
  Pill,
  Users,
  Compass,
  Upload,
  AlertOctagon,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AssistantMode } from '../types';

interface AccessibleControlsProps {
  onTriggerMode: (mode: AssistantMode, promptDesc?: string) => void;
  onOpenSOS: () => void;
  onOpenFaceManager: () => void;
  onOpenUpload: () => void;
  onOpenNavigation: () => void;
  isAnalyzing: boolean;
  autoLoopActive: boolean;
  onToggleAutoLoop: () => void;
  isLiveActive?: boolean;
  onToggleLive?: () => void;
}

export const AccessibleControls: React.FC<AccessibleControlsProps> = ({
  onTriggerMode,
  onOpenSOS,
  onOpenFaceManager,
  onOpenUpload,
  onOpenNavigation,
  isAnalyzing,
  autoLoopActive,
  onToggleAutoLoop,
  isLiveActive = false,
  onToggleLive,
}) => {
  return (
    <div
      id="accessible-controls-section"
      className="w-full flex flex-col gap-3"
      role="group"
      aria-label="Vision Assistant Feature Controls"
    >
      {/* Ask Questions & Live Voice Conversation Banner (gemini-3.1-flash-live-preview) */}
      {onToggleLive && (
        <button
          id="btn-live-conversation-card"
          type="button"
          onClick={onToggleLive}
          className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 shadow-lg active:scale-[0.99] text-left ${
            isLiveActive
              ? 'bg-gradient-to-r from-cyan-950 via-neutral-900 to-cyan-950 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
              : 'bg-neutral-900/90 border-cyan-700/60 hover:border-cyan-500'
          }`}
          aria-label={
            isLiveActive
              ? 'Live voice conversation active with Gemini Live API. Click to disconnect.'
              : 'Start live conversational voice Q and A with Gemini Live API.'
          }
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${isLiveActive ? 'bg-cyan-500 text-neutral-950 animate-pulse' : 'bg-cyan-950 text-cyan-400 border border-cyan-700/50'}`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-neutral-100">
                  Ask Questions & Live Conversation
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isLiveActive
                    ? 'bg-cyan-400 text-neutral-950 border-cyan-300 animate-pulse'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-700/70'
                }`}>
                  {isLiveActive ? 'Live Audio Connected' : 'gemini-3.1-flash-live-preview'}
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                {isLiveActive
                  ? 'Real-time conversational audio active. Speak any question naturally.'
                  : 'Tap to start real-time back-and-forth voice Q&A powered by Gemini Live API.'}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap border ${
            isLiveActive
              ? 'bg-cyan-400 text-neutral-950 border-cyan-300'
              : 'bg-neutral-800 text-cyan-300 border-neutral-700'
          }`}>
            {isLiveActive ? 'Stop Live' : 'Start Live Q&A'}
          </div>
        </button>
      )}

      {/* Primary High-Impact Row: SOS & What Do You See */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* EMERGENCY SOS BUTTON (Highest Contrast Red) */}
        <button
          id="sos-trigger-btn"
          type="button"
          onClick={onOpenSOS}
          className="w-full min-h-[58px] py-4 px-5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-extrabold rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-red-300 focus:ring-4 focus:ring-red-400 transition-transform active:scale-[0.98]"
          aria-label="Emergency SOS. Sends location alert to emergency contacts and initiates call."
        >
          <AlertOctagon className="w-7 h-7 text-white animate-pulse" />
          <div className="text-left leading-tight">
            <span className="block text-lg font-black tracking-wide">EMERGENCY SOS</span>
            <span className="block text-xs font-normal text-red-100">
              Voice: "SOS" or "Help Me"
            </span>
          </div>
        </button>

        {/* DESCRIBE SURROUNDINGS / WHAT DO YOU SEE (Primary Vision Action) */}
        <button
          id="describe-scene-btn"
          type="button"
          disabled={isAnalyzing}
          onClick={() => onTriggerMode('auto', 'What do you see in front of me?')}
          className="w-full min-h-[58px] py-4 px-5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-neutral-950 font-extrabold rounded-2xl shadow-xl flex items-center justify-center gap-3 border-2 border-amber-200 focus:ring-4 focus:ring-amber-300 transition-transform active:scale-[0.98] disabled:opacity-50"
          aria-label="Describe Surroundings. Analyzes camera view and speaks what is in front of you."
        >
          <Eye className="w-7 h-7 text-neutral-950" />
          <div className="text-left leading-tight">
            <span className="block text-lg font-black">WHAT DO YOU SEE?</span>
            <span className="block text-xs font-semibold text-neutral-800">
              Voice: "What is in front of me?"
            </span>
          </div>
        </button>
      </div>

      {/* Feature Grid: Read Text, Currency, Medicine, Faces, Navigation, Upload */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Read Text / OCR */}
        <button
          id="btn-ocr-mode"
          type="button"
          disabled={isAnalyzing}
          onClick={() => onTriggerMode('ocr', 'Read all visible text on signs, labels, or books')}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Read Text. OCR tool to read signboards, medicine labels, books and documents."
        >
          <FileText className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Read Text</div>
            <div className="text-[11px] font-normal text-neutral-400">OCR & Signs</div>
          </div>
        </button>

        {/* Currency Detection */}
        <button
          id="btn-currency-mode"
          type="button"
          disabled={isAnalyzing}
          onClick={() => onTriggerMode('currency', 'Detect currency banknotes and count total value')}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Detect Currency. Identifies rupee notes and counts total value."
        >
          <Banknote className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Count Currency</div>
            <div className="text-[11px] font-normal text-neutral-400">₹ Rupee Notes</div>
          </div>
        </button>

        {/* Medicine Detection */}
        <button
          id="btn-medicine-mode"
          type="button"
          disabled={isAnalyzing}
          onClick={() => onTriggerMode('medicine', 'Read medicine package name and visible expiry date')}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Check Medicine. Reads medicine package name and expiry date."
        >
          <Pill className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Read Medicine</div>
            <div className="text-[11px] font-normal text-neutral-400">Name & Expiry</div>
          </div>
        </button>

        {/* Face Recognition Manager */}
        <button
          id="btn-faces-mode"
          type="button"
          onClick={onOpenFaceManager}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Recognize Faces. Manage registered family and contact faces."
        >
          <Users className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Known Faces</div>
            <div className="text-[11px] font-normal text-neutral-400">Family & Contacts</div>
          </div>
        </button>

        {/* Navigation & GPS */}
        <button
          id="btn-navigation-mode"
          type="button"
          onClick={onOpenNavigation}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Open Navigation. GPS location and route walking guidance."
        >
          <Compass className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Navigation / GPS</div>
            <div className="text-[11px] font-normal text-neutral-400">Route & Location</div>
          </div>
        </button>

        {/* Upload Image */}
        <button
          id="btn-upload-image"
          type="button"
          onClick={onOpenUpload}
          className="min-h-[56px] p-3.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-xl flex items-center gap-2.5 font-bold text-sm focus:ring-2 focus:ring-amber-400 active:scale-95 transition-all text-left"
          aria-label="Upload Image. Analyze photo for objects, text, currency or medicine."
        >
          <Upload className="w-5 h-5 text-pink-400 flex-shrink-0" />
          <div>
            <div className="font-bold">Upload Image</div>
            <div className="text-[11px] font-normal text-neutral-400">Photo Analysis</div>
          </div>
        </button>
      </div>

      {/* Bottom Bar: Auto Vision Surveillance Loop Toggle */}
      <div className="flex items-center justify-between bg-neutral-900/90 border border-neutral-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm">
        <span className="text-neutral-300 font-medium flex items-center gap-2">
          <RefreshCw
            className={`w-4 h-4 text-cyan-400 ${autoLoopActive ? 'animate-spin' : ''}`}
          />
          Continuous Vision Surveillance
        </span>
        <button
          id="toggle-auto-loop-btn"
          type="button"
          onClick={onToggleAutoLoop}
          className={`px-3 py-1.5 font-bold rounded-lg transition-colors ${
            autoLoopActive
              ? 'bg-cyan-500 text-neutral-950 hover:bg-cyan-400'
              : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
          }`}
          aria-label={
            autoLoopActive
              ? 'Continuous vision surveillance is enabled. Tap to pause automatic checks.'
              : 'Continuous vision surveillance is paused. Tap to enable periodic automatic checks.'
          }
        >
          {autoLoopActive ? 'ACTIVE (Auto 6s)' : 'PAUSED'}
        </button>
      </div>
    </div>
  );
};
