import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Sparkles, AlertTriangle, CheckCircle, Volume2 } from 'lucide-react';
import { VisionAnalysisResult, SupportedLanguage } from '../types';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeImage: (base64Data: string, mode: string) => Promise<VisionAnalysisResult | null>;
  onSpeakText: (text: string, lang: SupportedLanguage) => void;
  activeLanguage: SupportedLanguage;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onAnalyzeImage,
  onSpeakText,
  activeLanguage,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WEBP).');
      return;
    }

    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setPreviewUrl(base64Data);
      setAnalyzing(true);
      try {
        const analysis = await onAnalyzeImage(base64Data, 'upload');
        setResult(analysis);
        if (analysis?.speech) {
          onSpeakText(analysis.speech, activeLanguage);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to analyze uploaded image.');
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Upload Image for Deep Vision Analysis"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-neutral-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-600/30 flex items-center justify-center text-pink-400 border border-pink-500">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Image Analysis</h2>
              <p className="text-xs text-neutral-400">
                Deep inspection: objects, text, medicine, currency, and obstacles.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800"
            aria-label="Close Upload Image Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? 'border-amber-400 bg-amber-950/20'
              : 'border-neutral-700 hover:border-neutral-500 bg-neutral-950'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Drag and drop an image or click to browse"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />
          <ImageIcon className="w-10 h-10 text-neutral-400" />
          <p className="text-sm font-bold text-neutral-200">
            Drag & drop image here, or <span className="text-amber-400 underline">Browse</span>
          </p>
          <p className="text-xs text-neutral-500">Supports JPEG, PNG, WEBP</p>
        </div>

        {/* Image Preview & Loading State */}
        {previewUrl && (
          <div className="flex flex-col gap-3">
            <div className="relative rounded-xl overflow-hidden max-h-56 bg-black flex items-center justify-center border border-neutral-800">
              <img
                src={previewUrl}
                alt="Uploaded preview"
                className="max-h-56 w-auto object-contain"
              />
              {analyzing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-cyan-300">
                  <Sparkles className="w-8 h-8 animate-spin" />
                  <p className="text-sm font-bold">AI Analyzing Image Content...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error / Safety Alert */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500 text-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Analysis Results Display */}
        {result && (
          <div className="flex flex-col gap-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Analysis Complete
              </span>
              <button
                type="button"
                onClick={() => onSpeakText(result.speech, activeLanguage)}
                className="px-3 py-1 bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1 hover:bg-amber-300"
                aria-label="Play spoken description again"
              >
                <Volume2 className="w-3.5 h-3.5" /> Re-play Speech
              </button>
            </div>

            {/* Vocal Output */}
            <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-sm font-semibold text-amber-300">
              "{result.speech}"
            </div>

            {/* Detected Objects Breakdown */}
            {result.detectedObjects && result.detectedObjects.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-neutral-400 mb-1.5">
                  Detected Objects ({result.detectedObjects.length}):
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.detectedObjects.map((obj) => (
                    <span
                      key={obj.id}
                      className={`px-2 py-1 rounded-md text-xs font-medium border ${
                        obj.isObstacle
                          ? 'bg-red-950 text-red-200 border-red-600'
                          : 'bg-neutral-900 text-neutral-200 border-neutral-700'
                      }`}
                    >
                      <strong className="capitalize">{obj.name}</strong>
                      {obj.color ? ` (${obj.color})` : ''} • {obj.position} • ~
                      {obj.distanceMeters || 1.5}m
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* OCR Extracted Text */}
            {result.ocrText && (
              <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800">
                <h4 className="text-xs font-bold text-cyan-400 mb-1">Extracted Text (OCR):</h4>
                <p className="text-xs text-neutral-200 whitespace-pre-wrap font-mono">
                  {result.ocrText}
                </p>
              </div>
            )}

            {/* Currency Breakdown */}
            {result.currency && result.currency.detected && (
              <div className="p-2.5 bg-emerald-950/50 rounded-lg border border-emerald-800 text-xs text-emerald-200">
                <strong>Currency Detected:</strong> {result.currency.description} (Total: {result.currency.currencySymbol}{result.currency.totalAmount})
              </div>
            )}

            {/* Medicine Breakdown */}
            {result.medicine && result.medicine.detected && (
              <div className="p-2.5 bg-purple-950/50 rounded-lg border border-purple-800 text-xs text-purple-200">
                <strong>Medicine:</strong> {result.medicine.medicineName || 'Detected package'} | Expiry: {result.medicine.expiryDate || 'Not visible'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
