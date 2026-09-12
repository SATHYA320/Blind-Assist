import { SupportedLanguage } from '../types';

/**
 * Detects the language of user's spoken input based on character scripts and common keyword markers.
 * Maps spoken speech to one of the supported languages ('en' | 'ta' | 'ml' | 'te' | 'kn' | 'hi').
 */
export function detectSpokenLanguage(text: string): SupportedLanguage {
  if (!text || !text.trim()) return 'en';

  const clean = text.trim();

  // 1. Unicode Script Range Check (Deterministic)
  // Tamil: \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(clean)) return 'ta';

  // Malayalam: \u0D00-\u0D7F
  if (/[\u0D00-\u0D7F]/.test(clean)) return 'ml';

  // Telugu: \u0C00-\u0C7F
  if (/[\u0C00-\u0C7F]/.test(clean)) return 'te';

  // Kannada: \u0C80-\u0CFF
  if (/[\u0C80-\u0CFF]/.test(clean)) return 'kn';

  // Devanagari (Hindi): \u0900-\u097F
  if (/[\u0900-\u097F]/.test(clean)) return 'hi';

  // 2. Romanized keywords / Common phrases in native Indian languages
  const lower = clean.toLowerCase();

  // Tamil / Tanglish Romanized markers (e.g. "Idhu enna?", "Enna object idhu?", "What object idhu?", "Indha bag enna color?")
  if (
    /\b(vanakkam|kann|enge|padikkavum|yenna|enna|paaru|kaapathu|kaappathu|idhu|adhu|yaar|irukku|panam|roobai|marunthu|indha|andha|color|colour|enna\s+object|object\s+idhu|enna\s+color|enna\s+colour|idhu\s+enna)\b/i.test(
      lower
    )
  ) {
    return 'ta';
  }

  // Hindi Romanized markers
  if (
    /\b(namaste|kya|hai|dekho|madad|kahan|yeh|voh|kaun|padho|paisa|rupaye|dawa|aage|peeche|kripya)\b/i.test(
      lower
    )
  ) {
    return 'hi';
  }

  // Malayalam Romanized markers
  if (
    /\b(namaskaram|enth|nokku|evide|sahayam|aaranu|ithu|ath|kaash|marunn)\b/i.test(
      lower
    )
  ) {
    return 'ml';
  }

  // Telugu Romanized markers
  if (
    /\b(namaskaram|enti|chudu|ekkada|sahayam|evaru|idi|adi|dabbulu|rupai|mandhu)\b/i.test(
      lower
    )
  ) {
    return 'te';
  }

  // Kannada Romanized markers
  if (
    /\b(namaskara|yenu|nodi|elli|sahaya|yaaru|idu|adu|hana|rupayi|aushadhi)\b/i.test(
      lower
    )
  ) {
    return 'kn';
  }

  return 'en';
}
