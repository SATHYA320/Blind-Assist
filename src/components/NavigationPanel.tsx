import React, { useState } from 'react';
import { Compass, MapPin, X, ExternalLink, Navigation as NavIcon, AlertCircle } from 'lucide-react';
import { LocationData } from '../services/deviceSensors';

interface NavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: LocationData | null;
  onRefreshLocation: () => Promise<void>;
  routeGuidanceText: string;
  onSpeakText: (text: string) => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onRefreshLocation,
  routeGuidanceText,
  onSpeakText,
}) => {
  const [destination, setDestination] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshLocation();
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenGoogleDirections = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;

    let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    if (currentLocation) {
      url += `&origin=${currentLocation.latitude},${currentLocation.longitude}&travelmode=walking`;
    }
    window.open(url, '_blank');
    onSpeakText(`Opening walking directions to ${destination}.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="GPS Navigation and Route Guidance Panel"
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-600/30 flex items-center justify-center text-orange-400 border border-orange-500">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">GPS & Route Guidance</h2>
              <p className="text-xs text-neutral-400">
                Live coordinates and camera path guidance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800"
            aria-label="Close Navigation Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Camera Path Guidance */}
        <div className="p-4 bg-cyan-950/50 border border-cyan-700/60 rounded-xl flex flex-col gap-1.5">
          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
            <NavIcon className="w-4 h-4" /> Camera Path Status:
          </span>
          <p className="text-sm font-semibold text-cyan-200">
            {routeGuidanceText || 'The path ahead appears clear. Continue forward.'}
          </p>
          <p className="text-[11px] text-cyan-400/80">
            Visual guidance is assistive and does not replace cane or service dog.
          </p>
        </div>

        {/* Current Location Box */}
        <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" /> Current Coordinates:
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs font-bold text-amber-400 hover:underline disabled:opacity-50"
            >
              {refreshing ? 'Updating GPS...' : 'Refresh GPS'}
            </button>
          </div>

          {currentLocation ? (
            <div className="flex flex-col gap-1 text-xs text-neutral-300">
              <p className="font-mono text-emerald-300 font-bold">
                Latitude: {currentLocation.latitude.toFixed(6)} | Longitude:{' '}
                {currentLocation.longitude.toFixed(6)}
              </p>
              <p className="text-neutral-400">Accuracy: ±{currentLocation.accuracy} meters</p>
              <a
                href={currentLocation.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs text-cyan-400 hover:underline flex items-center gap-1 font-bold"
              >
                <span>View Exact Pin on Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">
              Locating your position... Please ensure GPS/Location permission is granted.
            </p>
          )}
        </div>

        {/* Navigate to Destination Form */}
        <form onSubmit={handleOpenGoogleDirections} className="flex flex-col gap-2">
          <label htmlFor="nav-dest-input" className="text-xs font-bold text-neutral-300">
            Walking Navigation to Destination:
          </label>
          <div className="flex gap-2">
            <input
              id="nav-dest-input"
              type="text"
              placeholder="e.g. Metro Station, Pharmacy, City Park"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-700 text-white text-xs rounded-xl p-3 focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs active:scale-95 transition-transform"
            >
              Go
            </button>
          </div>
        </form>

        {/* Safety Notice */}
        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center gap-2 text-[11px] text-neutral-400">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            Always prioritize physical walking safety and physical orientation aids.
          </span>
        </div>
      </div>
    </div>
  );
};
