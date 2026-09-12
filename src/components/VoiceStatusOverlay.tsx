import React from 'react';
import { Mic, MicOff, Volume2, Globe, Sparkles, Key, CheckCircle, AlertCircle, ShieldCheck, Radio } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../types';

interface VoiceStatusOverlayProps {
  isListening: boolean;
  isSpeaking: boolean;
  isAnalyzing: boolean;
  transcript: string;
  lastSpokenText: string;
  activeLanguage: SupportedLanguage;
  wakeWordDetected: boolean;
  isVoiceVerified: boolean;
  voiceAuthStatusText: string;
  isLiveActive?: boolean;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onToggleMic: () => void;
  onEnrollVoice: () => void;
  onToggleLive?: () => void;
}

export const VoiceStatusOverlay: React.FC<VoiceStatusOverlayProps> = ({
  isListening,
  isSpeaking,
  isAnalyzing,
  transcript,
  lastSpokenText,
  activeLanguage,
  wakeWordDetected,
  isVoiceVerified,
  voiceAuthStatusText,
  isLiveActive = false,
  onLanguageChange,
  onToggleMic,
  onEnrollVoice,
  onToggleLive,
}) => {
  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguage);

  return (
    <div
      id="voice-status-hud"
      className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3"
      role="region"
      aria-label="Voice Assistant Status and Control"
    >
      {/* Top Header: Assistant Mode, Wake Word Indicator & Language Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Status Dot */}
          <span
            className={`w-3 h-3 rounded-full transition-all ${
              wakeWordDetected
                ? 'bg-amber-400 animate-ping'
                : isSpeaking
                ? 'bg-amber-300 animate-pulse'
                : isListening
                ? 'bg-emerald-400 animate-pulse'
                : isAnalyzing
                ? 'bg-cyan-400 animate-spin'
                : 'bg-neutral-500'
            }`}
          />
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-200">
            {isSpeaking
              ? 'Assistant Speaking'
              : wakeWordDetected
              ? '“Aira” Detected • Voice Verifying...'
              : isListening
              ? 'Listening for “Aira” keyword...'
              : isAnalyzing
              ? 'Analyzing visual frame...'
              : 'Voice Assistant Ready'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Wake-Word & Voice-Auth Badges */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
              wakeWordDetected
                ? 'bg-amber-950 text-amber-300 border-amber-500 animate-pulse'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800'
            }`}
            title="Start your command with 'Aira' (e.g. 'Aira, what do you see?')"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Wake-Word: “Aira”</span>
          </div>

          <div
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium bg-neutral-950 text-neutral-300 border border-neutral-800 cursor-pointer hover:border-emerald-500"
            onClick={onEnrollVoice}
            title="Click to calibrate/enroll your voice signature"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">{voiceAuthStatusText || 'Voice Verified'}</span>
          </div>

          {/* Multilingual Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-950 px-2.5 py-1 rounded-xl border border-neutral-800">
            <Globe className="w-3.5 h-3.5 text-neutral-400" />
            <label htmlFor="language-select" className="sr-only">
              Select Assistant Spoken Language
            </label>
            <select
              id="language-select"
              value={activeLanguage}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              className="bg-transparent text-xs font-semibold text-neutral-200 focus:outline-none cursor-pointer"
              aria-label="Spoken Language for Voice Input and Output"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-neutral-900 text-white">
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Center Display: User Query & Assistant Spoken Response */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[68px]">
        {/* User Voice Input Box */}
        <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 mb-1">
            <span className="flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" />
              You Said (Speech-to-Text):
            </span>
            <span className="text-neutral-500">{currentLangObj?.nativeName}</span>
          </div>
          <p
            id="user-transcript-display"
            className="text-sm font-medium text-neutral-100 italic break-words line-clamp-2"
          >
            {transcript ? `"${transcript}"` : 'Say "Aira, what do you see?", "Aira, read text", "Aira, count money"...'}
          </p>
        </div>

        {/* Assistant Spoken Vocal Output Box */}
        <div className="bg-neutral-950 rounded-xl p-3 border border-amber-900/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400 mb-1">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 text-amber-400" />
              Assistant Voice Output:
            </span>
            {isSpeaking && (
              <span className="text-[10px] text-amber-300 font-bold animate-pulse">
                VOCALIZING
              </span>
            )}
          </div>
          <p
            id="assistant-speech-display"
            aria-live="polite"
            className="text-sm font-semibold text-amber-200 break-words line-clamp-2"
          >
            {lastSpokenText || 'Assistant responds in the user’s language when “Aira” is spoken.'}
          </p>
        </div>
      </div>

      {/* Main Tactile Mic Action Button & Live Mode Toggle */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          id="main-voice-mic-btn"
          type="button"
          onClick={onToggleMic}
          className={`flex-1 flex items-center justify-center gap-3 py-3.5 px-5 rounded-xl font-extrabold text-base transition-all active:scale-[0.98] shadow-lg focus:ring-4 focus:ring-amber-400 ${
            isListening
              ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700'
          }`}
          aria-label={
            isListening
              ? 'Microphone is active and listening for keyword Aira. Click to pause listening.'
              : 'Microphone is paused. Click to enable listening for Aira.'
          }
        >
          {isListening ? (
            <>
              <Mic className="w-5 h-5 animate-pulse text-neutral-950" />
              <span className="truncate">Listening Active (“Aira”)</span>
            </>
          ) : (
            <>
              <MicOff className="w-5 h-5 text-neutral-400" />
              <span className="truncate">Enable Voice (“Aira”)</span>
            </>
          )}
        </button>

        {onToggleLive && (
          <button
            id="gemini-live-conversation-btn"
            type="button"
            onClick={onToggleLive}
            className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] border ${
              isLiveActive
                ? 'bg-cyan-500 text-neutral-950 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse'
                : 'bg-neutral-950 text-cyan-400 border-cyan-800/80 hover:bg-neutral-800'
            }`}
            aria-label={
              isLiveActive
                ? 'Gemini Live Conversation is active with gemini-3.1-flash-live-preview. Click to stop live voice session.'
                : 'Start real-time voice conversation with Gemini Live API (gemini-3.1-flash-live-preview).'
            }
          >
            <Radio className={`w-4 h-4 ${isLiveActive ? 'animate-spin text-neutral-950' : 'text-cyan-400'}`} />
            <span className="whitespace-nowrap">
              {isLiveActive ? 'Live Audio ON' : 'Live API Voice'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
