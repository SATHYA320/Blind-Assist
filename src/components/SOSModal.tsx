import React, { useState, useEffect } from 'react';
import { AlertOctagon, Phone, MessageSquare, MapPin, X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { EmergencyContact } from '../types';
import { LocationData, deviceSensors } from '../services/deviceSensors';
import { audioHaptics } from '../services/audioHaptics';
import { speechService } from '../services/speechSynthesis';

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSOSActive: boolean;
  onCancelSOS: () => void;
  onTriggerSOS: () => void;
  contacts: EmergencyContact[];
  onUpdateContacts: (contacts: EmergencyContact[]) => void;
  activeLocation: LocationData | null;
}

export const SOSModal: React.FC<SOSModalProps> = ({
  isOpen,
  onClose,
  isSOSActive,
  onCancelSOS,
  onTriggerSOS,
  contacts,
  onUpdateContacts,
  activeLocation,
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  if (!isOpen) return null;

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    if (contacts.length >= 3) {
      alert('Maximum 3 emergency contacts allowed.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || 'Contact',
    };
    onUpdateContacts([...contacts, newContact]);
    setName('');
    setPhone('');
    setRelationship('');
    setEditing(false);
  };

  const handleRemoveContact = (id: string) => {
    onUpdateContacts(contacts.filter((c) => c.id !== id));
  };

  const mapLink = activeLocation?.mapUrl || 'https://maps.google.com';
  const emergencyMessage = `EMERGENCY ALERT: I am visually impaired and require immediate assistance. My current GPS location is: ${mapLink}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency SOS System"
    >
      <div className="bg-neutral-900 border-2 border-red-500 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600/30 flex items-center justify-center text-red-500 border border-red-500">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">EMERGENCY SOS</h2>
              <p className="text-xs text-red-300">Voice command: "SOS" or "Cancel SOS"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800 focus:ring-2 focus:ring-red-400"
            aria-label="Close SOS Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Emergency Status Banner */}
        {isSOSActive ? (
          <div className="p-4 bg-red-950/80 border-2 border-red-500 rounded-xl flex flex-col gap-3 animate-pulse">
            <div className="flex items-center gap-2 text-red-300 font-black text-base">
              <AlertOctagon className="w-6 h-6 text-red-400" />
              EMERGENCY SOS IS CURRENTLY ACTIVE!
            </div>
            <p className="text-xs text-red-200">
              Broadcasting emergency alert with live GPS coordinates to your registered emergency contacts.
            </p>
            <button
              id="cancel-sos-btn"
              onClick={onCancelSOS}
              className="w-full py-3 bg-neutral-100 hover:bg-white text-red-700 font-extrabold rounded-xl text-base shadow-lg active:scale-95 transition-all"
              aria-label="Cancel active SOS alarm"
            >
              Cancel Emergency SOS (or say "Cancel SOS")
            </button>
          </div>
        ) : (
          <button
            id="trigger-sos-modal-btn"
            onClick={onTriggerSOS}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl shadow-xl border-2 border-red-400 active:scale-95 transition-all flex items-center justify-center gap-3"
            aria-label="Trigger Emergency SOS now"
          >
            <AlertOctagon className="w-6 h-6" />
            ACTIVATE SOS ALERT NOW
          </button>
        )}

        {/* GPS Location Status */}
        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-neutral-300">Live GPS Location:</p>
            <p className="text-xs text-neutral-400 truncate">
              {activeLocation
                ? `${activeLocation.addressSummary}`
                : 'Acquiring GPS coordinates...'}
            </p>
            <a
              href={mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:underline inline-block mt-0.5"
            >
              Open Google Maps Link
            </a>
          </div>
        </div>

        {/* Registered Emergency Contacts (Up to 3) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-200">
              Registered Contacts ({contacts.length} / 3)
            </h3>
            {contacts.length < 3 && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                aria-label="Add emergency contact"
              >
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </button>
            )}
          </div>

          {/* Contacts List */}
          <div className="flex flex-col gap-2">
            {contacts.length === 0 ? (
              <div className="p-4 bg-neutral-950 rounded-xl text-center text-xs text-neutral-400 border border-neutral-800">
                No emergency contacts registered yet. Please add up to 3 contacts (e.g. Mom, Dad, Caregiver).
              </div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-white">
                      {contact.name}{' '}
                      <span className="text-xs font-normal text-neutral-400">
                        ({contact.relationship})
                      </span>
                    </p>
                    <p className="text-xs text-neutral-300">{contact.phone}</p>
                  </div>

                  {/* Actions: Call & SMS */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${contact.phone}`}
                      className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                      title={`Call ${contact.name}`}
                      aria-label={`Call ${contact.name} at ${contact.phone}`}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a
                      href={`sms:${contact.phone}?body=${encodeURIComponent(emergencyMessage)}`}
                      className="p-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                      title={`Send SOS SMS to ${contact.name}`}
                      aria-label={`Send SOS SMS with GPS link to ${contact.name}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(contact.id)}
                      className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
                      aria-label={`Delete ${contact.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Contact Inline Form */}
          {editing && contacts.length < 3 && (
            <form
              onSubmit={handleAddContact}
              className="p-3 bg-neutral-950 border border-neutral-700 rounded-xl flex flex-col gap-2.5 mt-2"
            >
              <p className="text-xs font-bold text-amber-400">New Emergency Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. Mom)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2 focus:ring-2 focus:ring-amber-400"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (e.g. +91 9876543210)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2 focus:ring-2 focus:ring-amber-400"
                  required
                />
                <input
                  type="text"
                  placeholder="Relationship (e.g. Mother)"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg p-2 focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs hover:bg-amber-300"
                >
                  Save Contact
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Voice Commands Reminder */}
        <div className="bg-neutral-950/80 p-3 rounded-xl border border-neutral-800 text-[11px] text-neutral-400">
          <span className="font-bold text-neutral-200">Voice Control Tips:</span> Say{' '}
          <code className="text-amber-300">"SOS"</code>,{' '}
          <code className="text-amber-300">"Call Mom"</code>,{' '}
          <code className="text-amber-300">"Call Dad"</code>, or{' '}
          <code className="text-amber-300">"Cancel SOS"</code> hands-free anytime.
        </div>
      </div>
    </div>
  );
};
