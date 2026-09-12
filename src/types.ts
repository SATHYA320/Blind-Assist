export type SupportedLanguage = 'en' | 'ta' | 'ml' | 'te' | 'kn' | 'hi';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  speechCode: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-US' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechCode: 'ta-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechCode: 'ml-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN' },
];

export interface DetectedObject {
  id: string;
  name: string;
  confidence: number;
  color?: string;
  position: 'left' | 'center' | 'right';
  directionText?: string;
  distanceMeters?: number;
  distanceText?: string;
  isObstacle?: boolean;
  box?: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
  isUnknown?: boolean;
  unknownDetails?: {
    shape?: string;
    size?: string;
    structure?: string;
    texture?: string;
    material?: string;
  };
}

export interface CurrencyNote {
  denomination: number;
  count: number;
  currency: string;
}

export interface CurrencyAnalysis {
  detected: boolean;
  notes: CurrencyNote[];
  totalAmount: number;
  currencySymbol: string;
  description: string;
}

export interface MedicineAnalysis {
  detected: boolean;
  medicineName?: string;
  expiryDate?: string;
  visibleDetails?: string;
  warningDisclaimer: string;
}

export interface RecognizedPerson {
  name: string;
  relationship?: string;
  position?: 'left' | 'center' | 'right';
  confidence?: number;
}

export interface VisionAnalysisResult {
  sceneSummary: string;
  speech: string;
  detectedLanguage?: SupportedLanguage;
  detectedObjects: DetectedObject[];
  obstacles: string[];
  routeGuidance: string;
  ocrText?: string;
  currency?: CurrencyAnalysis;
  medicine?: MedicineAnalysis;
  recognizedFaces?: RecognizedPerson[];
  answer?: string;
  isSensitive?: boolean;
  isTemporaryUnavailable?: boolean;
  error?: string;
  timestamp: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export interface RegisteredFace {
  id: string;
  name: string;
  relationship: string;
  photoBase64?: string;
  descriptionNotes?: string;
  createdAt: number;
}

export type AssistantMode =
  | 'auto'
  | 'objects'
  | 'ocr'
  | 'currency'
  | 'medicine'
  | 'faces'
  | 'navigation'
  | 'qa';
