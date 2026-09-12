import React, { useState } from 'react';
import { Users, X, Plus, Trash2, Camera, ShieldCheck } from 'lucide-react';
import { RegisteredFace } from '../types';

interface FaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  faces: RegisteredFace[];
  onUpdateFaces: (faces: RegisteredFace[]) => void;
  onCaptureFaceSnapshot?: () => string | null;
}

export const FaceManagerModal: React.FC<FaceManagerModalProps> = ({
  isOpen,
  onClose,
  faces,
  onUpdateFaces,
  onCaptureFaceSnapshot,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCaptureFromCamera = () => {
    if (onCaptureFaceSnapshot) {
      const snap = onCaptureFaceSnapshot();
      if (snap) {
        setCapturedPhoto(snap);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveFace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newFace: RegisteredFace = {
      id: Date.now().toString(),
      name: name.trim(),
      relationship: relationship.trim() || 'Known Contact',
      descriptionNotes: notes.trim() || undefined,
      photoBase64: capturedPhoto || undefined,
      createdAt: Date.now(),
    };

    onUpdateFaces([...faces, newFace]);
    setName('');
    setRelationship('');
    setNotes('');
    setCapturedPhoto(null);
    setIsAdding(false);
  };

  const handleDeleteFace = (id: string) => {
    onUpdateFaces(faces.filter((f) => f.id !== id));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Registered Face Recognition Manager"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 border border-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Known Contacts Recognition</h2>
              <p className="text-xs text-neutral-400">
                Only registered, authorized people are announced by name.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800"
            aria-label="Close Known Contacts Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy & Security Note */}
        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center gap-2.5 text-xs text-neutral-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            Face data is stored only on your personal device. Unknown strangers are never named or profiled.
          </span>
        </div>

        {/* Existing Registered Faces List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200">
              Registered People ({faces.length})
            </h3>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Person
              </button>
            )}
          </div>

          {faces.length === 0 ? (
            <div className="p-4 bg-neutral-950 rounded-xl text-center text-xs text-neutral-400 border border-neutral-800">
              No contacts registered yet. Click "Add Person" or say "Recognize Face" to register loved ones and caregivers.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {face.photoBase64 ? (
                      <img
                        src={face.photoBase64}
                        alt={face.name}
                        className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-300">
                        {face.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">
                        {face.name}{' '}
                        <span className="text-xs font-normal text-neutral-400">
                          ({face.relationship})
                        </span>
                      </p>
                      {face.descriptionNotes && (
                        <p className="text-[11px] text-neutral-400 truncate">
                          {face.descriptionNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteFace(face.id)}
                    className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
                    aria-label={`Remove ${face.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Person Form */}
        {isAdding && (
          <form
            onSubmit={handleSaveFace}
            className="p-4 bg-neutral-950 border border-neutral-700 rounded-xl flex flex-col gap-3"
          >
            <h4 className="text-xs font-bold text-amber-400">Register New Contact</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Name (e.g. Mom, Brother, Dr. Patel)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400"
                required
              />
              <input
                type="text"
                placeholder="Relationship (e.g. Mother, Friend, Doctor)"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <input
              type="text"
              placeholder="Visual description (e.g. wears glasses, curly hair, blue jacket)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400"
            />

            {/* Photo / Snapshot Option */}
            <div className="flex items-center gap-3 flex-wrap">
              {capturedPhoto && (
                <img
                  src={capturedPhoto}
                  alt="Captured face preview"
                  className="w-12 h-12 rounded-lg object-cover border border-amber-400"
                />
              )}
              {onCaptureFaceSnapshot && (
                <button
                  type="button"
                  onClick={handleCaptureFromCamera}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-neutral-600"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  Snap From Camera
                </button>
              )}
              <label className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg cursor-pointer border border-neutral-600">
                Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs hover:bg-amber-300"
              >
                Save Person
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
