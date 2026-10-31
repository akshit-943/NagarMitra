import React, { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import Button from './ui/Button';
import {
  getComplaintById,
  triggerAiAnalysis,
  supportMasterIssue,
  getComplaintDuplicates,
  verifyMasterIssueResolution,
  trackComplaintSecurely,
} from '../services/complaintService';
import {
  MapPin,
  Image as ImageIcon,
  History,
  Copy,
  Check,
  Building,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle,
  Clock,
  UserCheck,
  ThumbsUp,
  Users,
  Layers,
  GitMerge,
  ThumbsDown,
  Timer,
  Send,
  ShieldCheck,
  Key,
} from 'lucide-react';
import { useCivic } from '../context/CivicContext';

export default function ComplaintDetailsModal({ complaintId, isOpen, onClose }) {
  const { navigateToMasterIssue, citizenUser, isCitizenAuthenticated, isAuthorityAuthenticated } = useCivic();
  const [complaint, setComplaint] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isRetryingAi, setIsRetryingAi] = useState(false);
  const [isSupporting, setIsSupporting] = useState(false);
  const [supportMessage, setSupportMessage] = useState(null);
  const [verificationFeedback, setVerificationFeedback] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState(null);

  // Secure Tracking Token State
  const [trackingToken, setTrackingToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('token') || '';
    } catch {
      return '';
    }
  });
  const [tokenInput, setTokenInput] = useState('');
  const [isOwnerVerified, setIsOwnerVerified] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);

  const fetchDetails = async () => {
    if (!complaintId) return;
    setLoading(true);
    setError(null);
    try {
      const initialToken = trackingToken || new URLSearchParams(window.location.search).get('token');
      let complaintData = null;

      if (initialToken) {
        try {
          const trackRes = await trackComplaintSecurely(complaintId, initialToken);
          if (trackRes.success && trackRes.data) {
            complaintData = trackRes.data;
            setIsOwnerVerified(true);
          }
        } catch {
          // Token didn't match; fall back to public view
        }
      }

      if (!complaintData) {
        const res = await getComplaintById(complaintId);
        complaintData = res.data;
      }

      const dupRes = await getComplaintDuplicates(complaintId).catch(() => ({ data: null }));
      setComplaint(complaintData);
      if (dupRes && dupRes.data) {
        setDuplicateInfo(dupRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load complaint records');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim() || !complaintId) return;
    setIsVerifyingToken(true);
    setTokenError(null);
    try {
      const res = await trackComplaintSecurely(complaintId, tokenInput.trim());
      if (res.success && res.data) {
        setComplaint(res.data);
        setIsOwnerVerified(true);
        setTrackingToken(tokenInput.trim());
      }
    } catch (err) {
      setTokenError(err.response?.data?.message || 'Invalid or mismatched tracking token');
    } finally {
      setIsVerifyingToken(false);
    }
  };

  useEffect(() => {
    if (complaintId && isOpen) {
      fetchDetails();
    }
  }, [complaintId, isOpen]);

  const handleCopyId = () => {
    if (!complaint?.complaintId) return;
    navigator.clipboard.writeText(complaint.complaintId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTriggerAi = async () => {
    if (!complaint?.complaintId) return;
    setIsRetryingAi(true);
    try {
      const res = await triggerAiAnalysis(complaint.complaintId);
      if (res.data) {
        setComplaint(res.data);
      }
    } catch (err) {
      alert(`AI Analysis trigger failed: ${err.message}`);
    } finally {
      setIsRetryingAi(false);
    }
  };

  const handleSupportMasterIssue = async () => {
    const miId = complaint?.masterIssueId || duplicateInfo?.masterIssueId;
    if (!miId) return;
    setIsSupporting(true);
    setSupportMessage(null);
    try {
      const res = await supportMasterIssue(miId);
      setSupportMessage(res.message || 'Your endorsement has been recorded!');
      if (duplicateInfo?.masterIssue) {
        setDuplicateInfo((prev) => ({
          ...prev,
          masterIssue: {
            ...prev.masterIssue,
            citizenSupportCount: res.citizenSupportCount,
            priority: res.priority || prev.masterIssue.priority,
          },
        }));
      }
    } catch (err) {
      setSupportMessage(err.response?.data?.message || err.message || 'Support recorded');
    } finally {
      setIsSupporting(false);
    }
  };

  const handleVerifyResolution = async (decision) => {
    const miId = complaint?.masterIssueId || duplicateInfo?.masterIssueId;
    if (!miId) {
      alert('No consolidated master issue attached to this report for resolution verification.');
      return;
    }
    setIsVerifying(true);
    setVerificationMessage(null);
    try {
      const res = await verifyMasterIssueResolution(miId, {
        decision,
        comment: verificationFeedback,
      });
      setVerificationMessage({
        type: 'success',
        text: res.message || `Verification recorded: ${decision}`,
      });
      if (duplicateInfo?.masterIssue) {
        setDuplicateInfo((prev) => ({
          ...prev,
          masterIssue: {
            ...prev.masterIssue,
            verificationStatus: res.verificationStatus || prev.masterIssue.verificationStatus,
            status: res.masterIssue?.status || prev.masterIssue.status,
          },
        }));
      }
    } catch (err) {
      setVerificationMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Verification could not be recorded',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'Resolved':
        return 'sage';
      case 'Resolution Submitted':
        return 'lavender';
      case 'In Progress':
        return 'lime';
      case 'Assigned':
        return 'blue';
      case 'Under Review':
        return 'lavender';
      case 'Rejected':
        return 'rose';
      default:
        return 'neutral';
    }
  };

  const getSeverityBadgeVariant = (level) => {
    switch (level) {
      case 'Critical':
        return 'rose';
      case 'High':
        return 'amber';
      case 'Medium':
        return 'lavender';
      default:
        return 'neutral';
    }
  };

  const ai = complaint?.aiAnalysis;
  const masterIssue = duplicateInfo?.masterIssue;
  const priority = masterIssue?.priority;

  const isSubmitter = Boolean(
    (isCitizenAuthenticated && citizenUser?._id && complaint?.citizenUserId && (String(complaint.citizenUserId) === String(citizenUser._id) || String(complaint.citizenUserId?._id) === String(citizenUser._id))) ||
    (isCitizenAuthenticated && citizenUser?.phone && complaint?.phone && complaint.phone === citizenUser.phone) ||
    isOwnerVerified
  );

  const isResolvedState = Boolean(
    complaint?.status === 'Resolved' ||
    complaint?.status === 'Resolution Submitted' ||
    masterIssue?.status === 'Resolved' ||
    masterIssue?.status === 'Resolution Submitted'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={complaint ? `Incident ${complaint.complaintId}` : 'Incident Details'}
      subtitle="Complete incident registry record with verified field audit timeline"
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-12 text-center text-xs text-[#7E828B] space-y-2">
          <div className="w-6 h-6 border-2 border-[#191B1D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Querying verified incident record from database...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-[#9E2B25] text-xs">
          <p className="font-semibold">Unable to retrieve complaint</p>
          <p>{error}</p>
        </div>
      ) : !complaint ? null : (
        <div className="space-y-6">
          {/* Header Row: ID, Badges, Copy */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F0EFEA] border border-[#E6E5DE]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-[#191B1D]">
                {complaint.complaintId}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 rounded-md text-[#7E828B] hover:text-[#191B1D] transition-colors"
                title="Copy Incident ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#3E520A]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {complaint.createdAt && (
                <span className="text-[11px] text-[#7E828B] flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(complaint.createdAt).toLocaleString()}
                </span>
              )}
              <Badge variant={getStatusBadgeVariant(complaint.status)} size="md" dot>
                {complaint.status}
              </Badge>
              {complaint.severity && (
                <Badge variant={getSeverityBadgeVariant(complaint.severity)} size="sm">
                  Severity: {complaint.severity}
                </Badge>
              )}
            </div>
          </div>

          {/* Citizen Verification & Ownership Status */}
          {complaint.verifiedPhone || isOwnerVerified ? (
            <div className="p-3.5 rounded-xl bg-[#F3F8D8] border border-[#D2E873] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#3E520A]">
                <ShieldCheck className="w-4 h-4 text-[#5A7314]" />
                <span className="font-semibold">Verified Citizen Submission:</span>
                <span className="font-mono bg-white/70 px-2 py-0.5 rounded border border-[#D2E873]">
                  {complaint.verifiedPhone || 'Authenticated Owner'}
                </span>
              </div>
              <span className="text-[11px] text-[#5A7314] font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Verified Submitter (Login-free)
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#191B1D] flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#7E828B]" />
                  Are you the citizen who submitted this report?
                </span>
                <span className="text-[10px] text-[#7E828B]">
                  Enter tracking token to unlock verified status
                </span>
              </div>
              <form onSubmit={handleVerifyToken} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste your private tracking token..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[#DDD] text-xs font-mono bg-white focus:outline-none focus:border-[#191B1D]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isVerifyingToken || !tokenInput.trim()}
                >
                  {isVerifyingToken ? 'Verifying...' : 'Unlock Updates'}
                </Button>
              </form>
              {tokenError && (
                <p className="text-[11px] text-[#9E2A2B]">{tokenError}</p>
              )}
            </div>
          )}

          {/* Master Issue & Collective Citizen Impact Section */}
          {(complaint.masterIssueId || masterIssue) && (
            <div className="p-4 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E5DE] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold text-[#7E828B] flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-[#191B1D]" /> Consolidated Master Issue
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        navigateToMasterIssue(complaint.masterIssueId || masterIssue?.masterIssueId);
                      }}
                      className="font-mono text-xs font-bold text-[#191B1D] bg-white hover:bg-[#F0EFEA] px-2 py-0.5 rounded border border-[#E6E5DE] transition-colors"
                      title="Inspect Master Issue Details"
                    >
                      {complaint.masterIssueId || masterIssue?.masterIssueId}
                    </button>
                  </div>
                  <p className="text-xs text-[#4B4E54]">
                    {complaint.isMasterIssuePrimary ? (
                      <span className="text-[#3E520A] font-medium">Primary anchor report for this location</span>
                    ) : (
                      <span className="text-[#3E7295] font-medium flex items-center gap-1">
                        <GitMerge className="w-3 h-3" /> Correlated with neighborhood master incident
                      </span>
                    )}
                  </p>
                </div>

                {/* Citizen Action: Verification Voting on Resolved issues, Submitter Notice, or "I am affected" */}
                <div className="flex items-center gap-2">
                  {isResolvedState ? (
                    <div className="flex items-center gap-1.5 bg-[#F0EFEA] p-1 rounded-full border border-[#E6E5DE] text-xs">
                      <span className="text-[10px] uppercase font-semibold text-[#7E828B] px-1.5 hidden sm:inline">Verify Fix:</span>
                      <button
                        onClick={() => handleVerifyResolution('Confirmed')}
                        disabled={isVerifying}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-[11px] bg-[#3E520A] text-white hover:bg-[#2F3E07] transition-colors disabled:opacity-50"
                        title="Confirm this civic issue is resolved"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Resolved</span>
                      </button>
                      <button
                        onClick={() => handleVerifyResolution('Disputed')}
                        disabled={isVerifying}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-[11px] bg-white border border-[#E6E5DE] text-[#9E2A2B] hover:bg-[#FBE8E8] transition-colors disabled:opacity-50"
                        title="Dispute resolution - issue still exists"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Not Resolved</span>
                      </button>
                    </div>
                  ) : isSubmitter ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F2F8D5] text-[#3E520A] border border-[#D2E873]">
                      <CheckCircle className="w-3.5 h-3.5 text-[#5A7314]" />
                      <span>You submitted this report</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSupportMasterIssue}
                      disabled={isSupporting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#191B1D] text-white hover:bg-[#333] transition-colors shadow-sm disabled:opacity-50"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isSupporting ? 'animate-bounce' : ''}`} />
                      <span>I am also affected</span>
                      <span className="ml-1 bg-white/20 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                        {masterIssue?.citizenSupportCount || 0}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {supportMessage && (
                <div className="p-2 rounded-lg bg-[#F3F8D8] border border-[#D2E873] text-[11px] text-[#3E520A] font-medium">
                  {supportMessage}
                </div>
              )}

              {/* Dynamic Civic Priority Score Breakdown */}
              {priority && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#191B1D] flex items-center gap-1">
                      <span>Dynamic Civic Priority:</span>
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        priority.level === 'Critical'
                          ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                          : priority.level === 'High'
                          ? 'bg-[#FBF1D8] text-[#865917]'
                          : 'bg-[#F3F8D8] text-[#3E520A]'
                      }`}>
                        {priority.score}/100 ({priority.level})
                      </span>
                    </span>
                    <span className="text-[11px] text-[#7E828B]">
                      {masterIssue?.supportingReportCount || 1} report(s) • {masterIssue?.citizenSupportCount || 0} endorsement(s)
                    </span>
                  </div>

                  {/* Priority contribution bar */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="p-1.5 rounded bg-white border border-[#E6E5DE]">
                      <span className="text-[#7E828B] block">AI Severity (40%)</span>
                      <span className="font-semibold text-[#191B1D] text-xs">{priority.breakdown?.severityScore ?? 50}</span>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-[#E6E5DE]">
                      <span className="text-[#7E828B] block">Safety Risk (25%)</span>
                      <span className="font-semibold text-[#191B1D] text-xs">{priority.breakdown?.safetyScore ?? 50}</span>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-[#E6E5DE]">
                      <span className="text-[#7E828B] block">Community (20%)</span>
                      <span className="font-semibold text-[#3E520A] text-xs">{priority.breakdown?.collectiveScore ?? 30}</span>
                    </div>
                    <div className="p-1.5 rounded bg-white border border-[#E6E5DE]">
                      <span className="text-[#7E828B] block">Location (15%)</span>
                      <span className="font-semibold text-[#191B1D] text-xs">{priority.breakdown?.locationScore ?? 50}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#7E828B] italic pt-0.5">
                    {priority.explanation}
                  </p>
                </div>
              )}

              {/* Sister reports */}
              {duplicateInfo?.sisterComplaints && duplicateInfo.sisterComplaints.length > 0 && (
                <div className="pt-2 border-t border-[#E6E5DE] space-y-1.5">
                  <span className="text-[10px] font-semibold text-[#7E828B] uppercase block">
                    Other Citizen Reports Linked to this Issue ({duplicateInfo.sisterComplaints.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {duplicateInfo.sisterComplaints.map((sc) => (
                      <span
                        key={sc.complaintId}
                        className="text-[11px] font-mono bg-white border border-[#E6E5DE] px-2 py-0.5 rounded text-[#191B1D]"
                      >
                        {sc.complaintId} ({sc.status})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details Overview */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-semibold text-[#7E828B] tracking-wider">
              Citizen Description
            </span>
            <p className="text-sm text-[#191B1D] leading-relaxed bg-white p-4 rounded-xl border border-[#E6E5DE]">
              {complaint.description}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] text-[#7E828B] uppercase font-semibold">Assigned Department</span>
              <p className="font-medium text-[#191B1D] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#3E7295]" />
                {masterIssue?.assignedDepartment || complaint.department || 'Municipal Public Works'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] text-[#7E828B] uppercase font-semibold">SLA Resolution Target</span>
              {masterIssue?.sla?.hasDeadline ? (
                <div className="flex items-center gap-1.5">
                  <Badge variant={masterIssue.sla.badgeVariant} size="sm">
                    {masterIssue.sla.statusLabel}
                  </Badge>
                  <span className="text-[10px] text-[#7E828B] font-mono">
                    Target: {new Date(masterIssue.sla.deadline).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <p className="font-medium text-[#7E828B] flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5" />
                  Standard Dispatch (72h)
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] text-[#7E828B] uppercase font-semibold">Category</span>
              <p className="font-medium text-[#191B1D]">{complaint.category}</p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1 sm:col-span-3">
              <span className="text-[10px] text-[#7E828B] uppercase font-semibold">Location Address</span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[#191B1D] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#8CA81F]" />
                  {complaint.location?.address}
                  {complaint.location?.latitude && (
                    <span className="font-mono text-[10px] text-[#7E828B] ml-2">
                      ({complaint.location.latitude.toFixed(4)}, {complaint.location.longitude.toFixed(4)})
                    </span>
                  )}
                </p>
                {complaint.locationSource && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F0EFEA] border border-[#E6E5DE] text-[#55478A] font-semibold">
                    {complaint.locationSource === 'gps'
                      ? 'GPS Geolocation'
                      : complaint.locationSource === 'map_selection'
                      ? 'Interactive Map Pin'
                      : complaint.locationSource === 'geocoding'
                      ? 'Address Geocoding'
                      : 'Manual Entry'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Phase 5: Before / After Resolution Evidence & Citizen Verification */}
          {(masterIssue?.resolutionEvidence?.length > 0 ||
            complaint.status === 'Resolution Submitted' ||
            complaint.status === 'Resolved' ||
            masterIssue?.status === 'Resolution Submitted' ||
            masterIssue?.status === 'Resolved') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E6E5DE] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E5DE] pb-3">
                <div>
                  <h4 className="font-semibold text-sm text-[#191B1D] flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#3E520A]" />
                    Municipal Work Completion &amp; Resolution Verification
                  </h4>
                  <p className="text-xs text-[#7E828B]">
                    Field crews have submitted evidence of work. Citizens are requested to confirm resolution.
                  </p>
                </div>
                <Badge
                  variant={
                    complaint.status === 'Resolved' || masterIssue?.status === 'Resolved'
                      ? 'sage'
                      : 'lavender'
                  }
                  size="md"
                >
                  {complaint.status === 'Resolved' || masterIssue?.status === 'Resolved'
                    ? 'Resolved & Closed'
                    : 'Resolution Submitted'}
                </Badge>
              </div>

              {/* Side-by-side Before / After Visual Evidence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-[#3E7295]" />
                    Before &bull; Citizen Intake Photograph
                  </span>
                  <div className="rounded-xl overflow-hidden border border-[#E6E5DE] bg-[#F7F7F4] h-52 flex items-center justify-center">
                    {complaint.imageUrl ? (
                      <img
                        src={complaint.imageUrl}
                        alt="Before Repair"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[#7E828B]">No intake photo available</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B] flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-[#3E520A]" />
                    After &bull; Municipal Resolution Evidence
                  </span>
                  <div className="rounded-xl overflow-hidden border border-[#E6E5DE] bg-[#F7F7F4] h-52 flex items-center justify-center">
                    {masterIssue?.resolutionEvidence?.[0]?.url ? (
                      <img
                        src={masterIssue.resolutionEvidence[0].url}
                        alt="After Resolution"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-[#7E828B]">Resolution photo pending field upload</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Work Description */}
              {masterIssue?.resolutionDescription && (
                <div className="p-3 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-xs space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B]">
                    Field Work Description:
                  </span>
                  <p className="text-[#191B1D] font-medium leading-relaxed">
                    {masterIssue.resolutionDescription}
                  </p>
                </div>
              )}

              {/* Citizen Verification Console */}
              <div className="pt-2 border-t border-[#E6E5DE] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#191B1D]">
                    Has this civic issue been properly resolved on-site?
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#3E520A] bg-[#F3F8D8] px-2 py-0.5 rounded font-mono font-semibold">
                      {masterIssue?.verificationStatus?.confirmedCount || 0} Confirmed
                    </span>
                    <span className="text-[#9E2A2B] bg-[#FBE8E8] px-2 py-0.5 rounded font-mono font-semibold">
                      {masterIssue?.verificationStatus?.disputedCount || 0} Still Exists
                    </span>
                  </div>
                </div>

                {verificationMessage && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium border ${
                      verificationMessage.type === 'success'
                        ? 'bg-[#F3F8D8] border-[#D2E873] text-[#3E520A]'
                        : 'bg-[#FBE8E8] border-[#F5C2BE] text-[#9E2A2B]'
                    }`}
                  >
                    {verificationMessage.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={verificationFeedback}
                    onChange={(e) => setVerificationFeedback(e.target.value)}
                    placeholder="Optional feedback (e.g. road fully paved, debris removed)"
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-[#E6E5DE] text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifyResolution('Confirmed')}
                      disabled={isVerifying}
                      className="px-3.5 py-2 rounded-xl bg-[#3E520A] text-white hover:bg-[#2F3E07] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Confirm Resolved</span>
                    </button>
                    <button
                      onClick={() => handleVerifyResolution('Disputed')}
                      disabled={isVerifying}
                      className="px-3.5 py-2 rounded-xl bg-white border border-[#E6E5DE] text-[#9E2A2B] hover:bg-[#FBE8E8] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>Still Exists</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attached Image Section */}
          {complaint.imageUrl && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-semibold text-[#7E828B] tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#3E7295]" />
                Attached Photographic Evidence (Cloudinary Hosted)
              </span>
              <div className="rounded-xl overflow-hidden border border-[#E6E5DE] bg-white max-h-72 flex items-center justify-center">
                <img
                  src={complaint.imageUrl}
                  alt={`Evidence for ${complaint.complaintId}`}
                  className="w-full h-auto object-cover max-h-72"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* GEMINI AI ANALYSIS SECTION */}
          {/* ======================================================== */}
          <div className="rounded-2xl border border-[#E6E5DE] bg-[#F7F7F4] p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#D2E873] flex items-center justify-center text-[#191B1D]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-[#191B1D] tracking-wide uppercase">
                    AI Analysis &bull; Gemini Intelligence
                  </h4>
                  <p className="text-[10px] text-[#7E828B]">
                    Multimodal visual &amp; textual infrastructure assessment
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    ai?.analysisStatus === 'Completed'
                      ? 'lime'
                      : ai?.analysisStatus === 'Processing'
                      ? 'lavender'
                      : ai?.analysisStatus === 'Failed'
                      ? 'rose'
                      : 'neutral'
                  }
                  size="sm"
                  dot
                >
                  {ai?.analysisStatus || 'Pending'}
                </Badge>

                {(ai?.analysisStatus === 'Failed' || ai?.analysisStatus === 'Pending' || !ai?.analysisStatus) && (
                  <button
                    onClick={handleTriggerAi}
                    disabled={isRetryingAi}
                    className="p-1 rounded-full text-[#7E828B] hover:text-[#191B1D] hover:bg-[#E6E5DE] transition-colors"
                    title="Retry AI Analysis"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRetryingAi ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Analysis State Rendering */}
            {ai?.analysisStatus === 'Processing' ? (
              <div className="py-6 text-center text-xs text-[#7E828B] space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#8CA81F]" />
                <p>Gemini vision model is examining field photograph and description...</p>
              </div>
            ) : ai?.analysisStatus === 'Failed' ? (
              <div className="p-3.5 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-xs text-[#9E2B25] space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-[#D93F36]" />
                  <span>AI Analysis Failed</span>
                </div>
                <p className="text-[11px]">{ai.error || 'Gemini could not analyze the image or description.'}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerAi}
                  disabled={isRetryingAi}
                  icon={RefreshCw}
                >
                  {isRetryingAi ? 'Retrying Analysis...' : 'Retry Gemini Analysis'}
                </Button>
              </div>
            ) : ai?.analysisStatus === 'Completed' ? (
              <div className="space-y-4">
                {/* Score & Categorization Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Severity Metric Card */}
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-[#7E828B]">
                        Severity Score
                      </span>
                      <Badge variant={getSeverityBadgeVariant(ai.severityLevel)} size="sm">
                        {ai.severityLevel}
                      </Badge>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="font-editorial text-3xl font-bold text-[#191B1D]">
                        {ai.severityScore}
                      </span>
                      <span className="text-xs text-[#7E828B]">/ 100</span>
                    </div>

                    {/* Visual Severity Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#F0EFEA] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ai.severityScore >= 75
                            ? 'bg-[#9E2B25]'
                            : ai.severityScore >= 50
                            ? 'bg-[#C28222]'
                            : ai.severityScore >= 25
                            ? 'bg-[#3E7295]'
                            : 'bg-[#507C4D]'
                        }`}
                        style={{ width: `${ai.severityScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Detected Issue Card */}
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-[#7E828B]">
                      AI Classification
                    </span>
                    <p className="font-semibold text-sm text-[#191B1D] line-clamp-2">
                      {ai.detectedIssue}
                    </p>
                    <p className="text-[11px] text-[#7E828B]">Category: {ai.category}</p>
                  </div>

                  {/* Confidence & Routing */}
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-[#7E828B]">
                      Confidence &amp; Route
                    </span>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[#191B1D]">
                      <span>{Math.round((ai.confidence || 0) * 100)}%</span>
                      <span className="text-[11px] font-normal text-[#7E828B]">AI Confidence</span>
                    </div>
                    <p className="text-[11px] text-[#3E7295] font-medium truncate">
                      {ai.department}
                    </p>
                  </div>
                </div>

                {/* Reasoning Quote */}
                {ai.reasoning && (
                  <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] text-xs text-[#4B4E54] space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                      AI Assessment Rationale
                    </span>
                    <p className="leading-relaxed italic text-[#191B1D]">
                      &ldquo;{ai.reasoning}&rdquo;
                    </p>
                  </div>
                )}

                {/* Safety Risk Card */}
                {ai.safetyRisk && (
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-[#7E828B] flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#9E2B25]" />
                        Safety Risk Analysis
                      </span>
                      <Badge
                        variant={
                          ai.safetyRisk.level === 'Critical'
                            ? 'rose'
                            : ai.safetyRisk.level === 'High'
                            ? 'amber'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        Risk: {ai.safetyRisk.level}
                      </Badge>
                    </div>

                    <p className="text-xs text-[#191B1D] font-medium">
                      {ai.safetyRisk.description}
                    </p>

                    {ai.safetyRisk.affectedGroups && ai.safetyRisk.affectedGroups.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="text-[#7E828B]">Potentially Affected:</span>
                        {ai.safetyRisk.affectedGroups.map((group, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full bg-[#F0EFEA] text-[#191B1D] font-medium text-[10px]"
                          >
                            {group}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations List - restricted strictly to municipal administrators */}
                {isAuthorityAuthenticated && ai.recommendations && ai.recommendations.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-2 text-xs">
                    <span className="text-[10px] uppercase font-semibold text-[#7E828B] flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-[#191B1D]" />
                      Recommended Municipal Corrective Actions (Administrator Only)
                    </span>
                    <ul className="space-y-1.5 list-disc list-inside text-xs text-[#191B1D]">
                      {ai.recommendations.map((rec, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Human Review Banner if required */}
                {ai.requiresHumanReview && (
                  <div className="p-3 rounded-xl bg-[#FAF0DE] border border-[#EEDBBA] text-xs text-[#865917] flex items-start gap-2.5">
                    <UserCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs">Human Verification Flagged</p>
                      <p className="text-[11px] text-[#865917]/90 mt-0.5">
                        Gemini flagged this incident for physical on-site verification due to visual ambiguity, safety threshold, or non-standard infrastructure parameters.
                      </p>
                    </div>
                  </div>
                )}

                {/* Model Metadata footer */}
                <div className="flex items-center justify-between text-[10px] text-[#A2A6B0] pt-1">
                  <span>Engine: {ai.modelUsed || 'gemini-3-flash-preview'} &bull; Multimodal GenAI</span>
                  <span>
                    Analyzed: {ai.analyzedAt ? new Date(ai.analyzedAt).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-[#7E828B] space-y-2">
                <p>AI Analysis is queued for this incident.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerAi}
                  disabled={isRetryingAi}
                  icon={Sparkles}
                >
                  {isRetryingAi ? 'Analyzing...' : 'Run Gemini Analysis Now'}
                </Button>
              </div>
            )}
          </div>

          {/* Status History & Audit Trail */}
          <div className="space-y-3 pt-2">
            <span className="text-[10px] uppercase font-semibold text-[#7E828B] tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Audit Trail &amp; Status Timeline
            </span>

            <div className="space-y-2.5">
              {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
                complaint.statusHistory.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white border border-[#E6E5DE] text-xs"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#191B1D] mt-1.5 flex-shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#191B1D]">
                          Status: {step.toStatus}
                        </span>
                        <span className="text-[10px] text-[#7E828B]">
                          {new Date(step.changedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4B4E54]">{step.note || 'Status updated.'}</p>
                      <span className="text-[10px] text-[#7E828B] block">
                        Action by: {step.changedBy}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#7E828B] italic">No prior status transitions recorded.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#E6E5DE]">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Inspector
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
