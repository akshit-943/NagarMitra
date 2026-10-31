import React, { useState } from 'react';
import { useCivic } from '../../context/CivicContext';
import {
  FileText,
  MapPin,
  Building2,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

/**
 * Component: ComplaintDraftCard
 * Rendered inline inside the assistant chat window when a complaint draft is generated.
 * Allows the user to verify the AI assessment and submit using the existing complaint pipeline.
 * 
 * @param {Object} props
 * @param {Object} props.draft - The AI-generated draft { title, description, category, department, address, severity }
 * @param {Function} [props.onSubmitted] - Optional callback after successful submission
 */
export default function ComplaintDraftCard({ draft, onSubmitted }) {
  const {
    submitComplaint,
    setIsSubmitModalOpen,
    setSelectedComplaintId,
    isCitizenAuthenticated,
    citizenUser,
  } = useCivic();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [guestPhone, setGuestPhone] = useState('');

  if (!draft) return null;

  // Map category to matching frontend category value
  const normalizeCategory = (cat = '') => {
    const c = cat.toLowerCase();
    if (c.includes('road') || c.includes('pavement')) return 'Roadways & Pavement';
    if (c.includes('water') || c.includes('drain')) return 'Water & Sanitation';
    if (c.includes('light') || c.includes('electr')) return 'Electrical & Lighting';
    if (c.includes('garbage') || c.includes('waste') || c.includes('sanitat')) return 'Sanitation & Waste';
    if (c.includes('park') || c.includes('tree') || c.includes('environ')) return 'Parks & Public Realm';
    return 'Roadways & Pavement';
  };

  // Map severity string to urgency level expected by submitComplaint
  const mapSeverityToUrgency = (sev = '') => {
    const s = sev.toLowerCase();
    if (s.includes('crit')) return 'Critical';
    if (s.includes('high')) return 'High';
    if (s.includes('low')) return 'Low';
    return 'Moderate';
  };

  const handleSubmitDirectly = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const activePhone = isCitizenAuthenticated ? citizenUser?.phone : guestPhone.trim();

      if (!isCitizenAuthenticated && (!activePhone || activePhone.length < 10)) {
        setSubmitError('Please enter a valid 10-digit mobile number for dispatch updates, or click "Open in Form".');
        setIsSubmitting(false);
        return;
      }

      const payload = {
        title: draft.title || 'Civic Grievance',
        description: draft.description || draft.title || '',
        category: normalizeCategory(draft.category),
        urgency: mapSeverityToUrgency(draft.severity),
        address: draft.address || 'Address captured via Civic Assistant',
        phone: activePhone,
        verifiedPhone: activePhone,
      };

      const result = await submitComplaint(payload);

      if (result && result.success && result.data) {
        setSubmissionResult(result.data);
        if (typeof onSubmitted === 'function') {
          onSubmitted(result.data);
        }
      } else {
        throw new Error(result?.message || 'Failed to submit complaint.');
      }
    } catch (err) {
      console.error('❌ [ComplaintDraftCard] Submission error:', err);
      setSubmitError(err.message || 'An error occurred while submitting your complaint.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenInModal = () => {
    setIsSubmitModalOpen(true);
  };

  // Severity color badge
  const getSeverityBadgeClass = (sev = '') => {
    const s = sev.toLowerCase();
    if (s.includes('crit')) return 'bg-rose-100 text-rose-800 border-rose-300';
    if (s.includes('high')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (s.includes('low')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  return (
    <div className="mt-3 p-3.5 rounded-xl bg-white border border-[#E6E5DE] shadow-sm text-xs text-[#191B1D] space-y-2.5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#F2F1E8]">
        <div className="flex items-center gap-1.5 font-semibold text-[#191B1D]">
          <FileText className="w-3.5 h-3.5 text-[#191B1D]" />
          <span>Prepared Complaint Draft</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getSeverityBadgeClass(
            draft.severity
          )}`}
        >
          {draft.severity || 'Medium'} Severity
        </span>
      </div>

      {/* Main Details */}
      <div className="space-y-1.5">
        <h4 className="font-semibold text-[13px] text-[#191B1D]">{draft.title}</h4>
        <p className="text-[11.5px] text-[#4B4E54] leading-relaxed line-clamp-3">
          {draft.description}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-[#7E828B]">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-[#A2A6B0] shrink-0" />
            <span className="truncate">{draft.department || 'Municipal Public Works'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-[#A2A6B0] shrink-0" />
            <span className="truncate">{draft.address || 'Location on record'}</span>
          </div>
        </div>
      </div>

      {/* Success View */}
      {submissionResult ? (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-[12px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Complaint Lodged Successfully!</span>
          </div>
          <p className="text-[11px] text-emerald-800">
            Assigned Complaint ID:{' '}
            <strong className="font-mono">{submissionResult.complaintId}</strong>
          </p>
          <button
            type="button"
            onClick={() => setSelectedComplaintId(submissionResult.complaintId || submissionResult._id)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline mt-1"
          >
            <span>View full tracking timeline</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      ) : (
        /* Action Buttons & Guest Phone Input */
        <div className="pt-2 space-y-2">
          {!isCitizenAuthenticated && (
            <div>
              <label className="block text-[10px] font-medium text-[#7E828B] mb-1">
                Mobile Number (for SMS & incident tracking)
              </label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                maxLength={10}
                className="w-full px-2.5 py-1.5 text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-lg focus:outline-none focus:border-[#191B1D] font-mono"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitDirectly}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#191B1D] hover:bg-[#2C3035] text-white text-[11px] font-medium flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting to Municipal Queue...</span>
              </>
            ) : (
              <>
                <span>Submit Grievance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleOpenInModal}
            className="py-1.5 px-3 rounded-lg bg-[#F7F7F4] hover:bg-[#EBEAE4] text-[#4B4E54] text-[11px] font-medium border border-[#E6E5DE] transition-colors cursor-pointer text-center"
          >
            Open in Form
          </button>
        </div>
      </div>
    )}

      {/* Error state */}
      {submitError && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}
    </div>
  );
}
