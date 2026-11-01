import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  getMasterIssueById,
  updateMasterIssueStatus,
  assignMasterIssue,
  addMasterIssueNote,
  uploadResolutionEvidence,
  verifyMasterIssueResolution,
  assessMasterIssueResolution,
  getMasterIssueActivity,
  getDemoOfficers,
} from '../services/complaintService';
import { useCivic } from '../context/CivicContext';
import {
  ArrowLeft,
  Layers,
  MapPin,
  Building,
  ThumbsUp,
  AlertTriangle,
  GitMerge,
  ExternalLink,
  Clock,
  Check,
  Users,
  Flame,
  ShieldAlert,
  RefreshCw,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  UserCheck,
  Lock,
  Upload,
  ArrowRight,
  MessageSquare,
  FileText,
  Hourglass,
  Sliders,
  Send,
  Eye,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export default function MasterIssueDetailsPage({ masterIssueId, onBack }) {
  const {
    setSelectedComplaintId,
    resolveDuplicateAction,
    endorseIssue,
    fetchLiveMasterIssues,
    fetchLiveComplaints,
  } = useCivic();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [resolvingComplaintId, setResolvingComplaintId] = useState(null);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Phase 5 State
  const [officerDirectory, setOfficerDirectory] = useState({ departments: [], officers: [] });
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [customSlaHours, setCustomSlaHours] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Internal Notes State
  const [newNote, setNewNote] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('Municipal Dispatcher');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Evidence Upload State
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [resolutionDescription, setResolutionDescription] = useState('');
  const [evidenceOfficer, setEvidenceOfficer] = useState('');
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);

  // Activity Log State
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Citizen Verification State
  const [verificationComment, setVerificationComment] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAssessingResolution, setIsAssessingResolution] = useState(false);

  const fetchDetails = async (retryCount = 2) => {
    if (!masterIssueId) {
      setError('No Master Issue ID provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getMasterIssueById(masterIssueId);
      if (res.success && res.data) {
        setIssue(res.data);
        setSelectedDept(res.data.assignedDepartment || res.data.department || 'Municipal Public Works');
        if (res.data.assignedOfficer?.id) {
          setSelectedOfficerId(res.data.assignedOfficer.id);
        }
      } else {
        setError(res.message || `Master issue '${masterIssueId}' could not be retrieved.`);
      }
    } catch (err) {
      console.error('Error fetching master issue details:', err);
      const isNetworkErr = err.message === 'Network Error' || !err.status;
      if (isNetworkErr && retryCount > 0) {
        console.log(`Retrying fetchDetails for ${masterIssueId} (${retryCount} retries remaining)...`);
        setTimeout(() => fetchDetails(retryCount - 1), 2500);
        return;
      }
      setError(
        isNetworkErr
          ? 'Network connection interrupted. The server may be waking up from standby or unreachable. Please click Try Again.'
          : (err.message || `Unable to load master issue '${masterIssueId}'. It may have been removed or the ID is invalid.`)
      );
    } finally {
      if (retryCount === 0 || !error) {
        setLoading(false);
      }
    }
  };

  const fetchActivities = async () => {
    if (!masterIssueId) return;
    setLoadingActivities(true);
    try {
      const res = await getMasterIssueActivity(masterIssueId, false);
      if (res.success) {
        setActivities(res.data || []);
      }
    } catch (err) {
      console.warn('Could not fetch activity log:', err.message);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchDirectory = async () => {
    try {
      const res = await getDemoOfficers();
      if (res.success && res.data) {
        setOfficerDirectory(res.data);
      }
    } catch (err) {
      console.warn('Could not load officer directory:', err.message);
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchActivities();
    fetchDirectory();
  }, [masterIssueId]);

  // Handle Department & Officer Assignment
  const handleAssign = async (e) => {
    e?.preventDefault();
    if (!issue?.masterIssueId || isAssigning) return;

    setIsAssigning(true);
    try {
      const res = await assignMasterIssue(issue.masterIssueId, {
        department: selectedDept,
        officerId: selectedOfficerId,
        customDeadlineHours: customSlaHours ? Number(customSlaHours) : undefined,
        assignedBy: 'Municipal Command Dispatcher',
      });
      if (res.success) {
        alert(res.message);
        await fetchDetails();
        await fetchActivities();
        fetchLiveMasterIssues();
        fetchLiveComplaints();
      }
    } catch (err) {
      alert(`Assignment error: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle Lifecycle Status Transition
  const handleStatusChange = async (newStatus, customNote = null, customRejectionReason = null) => {
    if (!issue?.masterIssueId) return;

    if (newStatus === 'Rejected' && !customRejectionReason) {
      setShowRejectModal(true);
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await updateMasterIssueStatus(issue.masterIssueId, {
        status: newStatus,
        note: customNote || `Operational status transitioned to ${newStatus} from Master Issue Details Console`,
        rejectionReason: customRejectionReason,
        changedBy: 'Municipal Authority Dispatcher',
      });
      setShowRejectModal(false);
      setRejectionReason('');
      await fetchDetails();
      await fetchActivities();
      fetchLiveMasterIssues();
      fetchLiveComplaints();
    } catch (err) {
      alert(`Status transition error: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Internal Note Submission
  const handleAddNote = async (e) => {
    e?.preventDefault();
    if (!newNote.trim() || isSubmittingNote) return;

    setIsSubmittingNote(true);
    try {
      const res = await addMasterIssueNote(issue.masterIssueId, {
        note: newNote.trim(),
        author: noteAuthor,
      });
      if (res.success) {
        setNewNote('');
        await fetchDetails();
        await fetchActivities();
      }
    } catch (err) {
      alert(`Note creation failed: ${err.message}`);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Handle Resolution Evidence Upload (Before/After)
  const handleUploadEvidence = async (e) => {
    e?.preventDefault();
    if (evidenceFiles.length === 0 && !resolutionDescription.trim()) {
      alert('Please select at least one evidence photograph.');
      return;
    }

    setIsUploadingEvidence(true);
    try {
      const formData = new FormData();
      Array.from(evidenceFiles).forEach((file) => {
        formData.append('evidence', file);
      });
      formData.append('description', resolutionDescription.trim());
      formData.append(
        'uploadedBy',
        evidenceOfficer || issue?.assignedOfficer?.name || 'Municipal Field Operations Lead'
      );

      const res = await uploadResolutionEvidence(issue.masterIssueId, formData);
      if (res.success) {
        alert(res.message);
        setEvidenceFiles([]);
        setResolutionDescription('');
        await fetchDetails();
        await fetchActivities();
        fetchLiveMasterIssues();
        fetchLiveComplaints();
      }
    } catch (err) {
      alert(`Evidence upload error: ${err.message}`);
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  // Citizen Resolution Verification ("Confirmed" or "Disputed")
  const handleVerificationVote = async (response) => {
    if (!issue?.masterIssueId || isVerifying) return;

    setIsVerifying(true);
    try {
      const res = await verifyMasterIssueResolution(issue.masterIssueId, {
        response,
        comment: verificationComment.trim(),
      });
      if (res.success) {
        alert(res.message);
        setVerificationComment('');
        await fetchDetails();
        await fetchActivities();
      }
    } catch (err) {
      alert(`Verification error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Trigger on-demand Gemini AI Before & After verification comparison
  const handleTriggerAiAssessment = async () => {
    if (!issue?.masterIssueId || isAssessingResolution) return;
    setIsAssessingResolution(true);
    try {
      const res = await assessMasterIssueResolution(issue.masterIssueId);
      if (res?.success && res.data) {
        setIssue(res.data);
      }
    } catch (err) {
      alert(`AI assessment error: ${err.message || 'Unable to run AI resolution check.'}`);
    } finally {
      setIsAssessingResolution(false);
    }
  };

  const handleResolveDuplicate = async (complaintId, action) => {
    if (!issue?.masterIssueId) return;
    setResolvingComplaintId(complaintId);
    try {
      await resolveDuplicateAction(issue.masterIssueId, complaintId, action);
      await fetchDetails();
      await fetchActivities();
      fetchLiveMasterIssues();
      fetchLiveComplaints();
    } catch (err) {
      alert(`Duplicate triage error: ${err.message}`);
    } finally {
      setResolvingComplaintId(null);
    }
  };

  const handleEndorse = async () => {
    if (!issue?.masterIssueId || isEndorsing || issue.hasSupported) return;
    setIsEndorsing(true);
    try {
      await endorseIssue(issue.masterIssueId);
      await fetchDetails();
    } catch (err) {
      alert(err.message || 'Could not register citizen endorsement');
    } finally {
      setIsEndorsing(false);
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
        return 'amber';
      case 'Under Review':
        return 'lavender';
      case 'Rejected':
        return 'rose';
      default:
        return 'neutral';
    }
  };

  const priority = issue?.priority;
  const breakdown = priority?.breakdown || {};
  const pendingDuplicates = issue?.potentialDuplicates?.filter((p) => p.status === 'Pending') || [];
  const associatedComplaints = issue?.associatedComplaints || [];
  const statusHistory = issue?.statusHistory || [];
  const internalNotes = issue?.internalNotes || [];
  const resolutionEvidence = issue?.resolutionEvidence || [];
  const verification = issue?.verificationStatus || { confirmedCount: 0, disputedCount: 0 };
  const sla = issue?.sla || {};

  // Filter officers for current department selection
  const deptOfficers = officerDirectory.officers.filter(
    (off) => !selectedDept || off.department.toLowerCase() === selectedDept.toLowerCase()
  );

  // Collect original citizen complaint intake images (BEFORE)
  const originalIntakeImages = associatedComplaints
    .filter((c) => c.imageUrl)
    .map((c) => ({
      complaintId: c.complaintId,
      url: c.imageUrl,
      createdAt: c.createdAt,
      description: c.description,
    }));

  return (
    <div className="space-y-6 py-2">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E6E5DE]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full border border-[#E6E5DE] bg-white text-[#191B1D] hover:bg-[#F0EFEA] transition-colors flex items-center justify-center cursor-pointer"
            title="Return to Municipal Command"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#7E828B]">Municipal Command Operations</span>
              <span className="text-xs text-[#7E828B]">&bull;</span>
              <span className="text-xs font-mono font-semibold text-[#191B1D]">
                {masterIssueId || 'Master Issue'}
              </span>
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl text-[#191B1D]">
              Authority Operations &amp; SLA Management
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              fetchDetails();
              fetchActivities();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onBack}
          >
            Back to Queue
          </Button>
        </div>
      </div>

      {/* 2. LOADING STATE */}
      {loading && (
        <div className="py-24 text-center space-y-3 bg-white rounded-3xl border border-[#E6E5DE]">
          <div className="w-8 h-8 border-2 border-[#191B1D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#7E828B] font-medium">
            Loading master issue operational data, SLA telemetry, and resolution records...
          </p>
        </div>
      )}

      {/* 3. ERROR / NOT-FOUND STATE (NEVER BLANK PAGE) */}
      {!loading && error && (
        <div className="p-8 rounded-3xl bg-white border border-[#F5C2BE] space-y-4 max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-[#FBE8E8] flex items-center justify-center text-[#9E2A2B]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-editorial text-xl text-[#9E2A2B]">
              Master Issue Not Available
            </h2>
            <p className="text-xs text-[#7E828B] mt-1 leading-relaxed">
              {error}
            </p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={onBack}
            >
              Return to Municipal Command
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchDetails(2)}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* 4. MAIN DETAILS VIEW */}
      {!loading && !error && issue && (
        <div className="space-y-6">
          {/* Main Operational Header Card */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6E5DE]">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#191B1D] bg-[#F0EFEA] px-3 py-1 rounded-full border border-[#E6E5DE] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#55478A]" />
                    {issue.masterIssueId}
                  </span>
                  <Badge variant={getStatusBadgeVariant(issue.status)} size="md" dot>
                    {issue.status}
                  </Badge>
                  {priority && (
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                        priority.level === 'Critical'
                          ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                          : priority.level === 'High'
                          ? 'bg-[#FBF1D8] text-[#865917]'
                          : 'bg-[#F3F8D8] text-[#3E520A]'
                      }`}
                    >
                      Priority {priority.score}/100 &bull; {priority.level}
                    </span>
                  )}
                  {sla.hasDeadline && (
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                        sla.isOverdue
                          ? 'bg-[#FBE8E8] text-[#9E2A2B] border border-[#F5C2BE]'
                          : sla.isApproaching
                          ? 'bg-[#FFF9E6] text-[#865917] border border-[#F5E296]'
                          : 'bg-[#E9F3C6] text-[#3E520A] border border-[#D2E873]'
                      }`}
                    >
                      <Hourglass className="w-3 h-3" />
                      {sla.statusLabel}
                    </span>
                  )}
                </div>
                <h2 className="font-editorial text-2xl sm:text-3xl text-[#191B1D]">
                  {issue.title}
                </h2>
              </div>

              {/* Status Lifecycle Dispatch Bar */}
              <div className="space-y-1.5 text-right">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  Operational Lifecycle Transitions:
                </span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {['Under Review', 'In Progress', 'Resolved'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(st)}
                      disabled={isUpdatingStatus || issue.status === st}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        issue.status === st
                          ? 'bg-[#191B1D] text-white shadow-xs cursor-default'
                          : 'bg-white border border-[#E6E5DE] text-[#4B4E54] hover:bg-[#F0EFEA] hover:text-[#191B1D]'
                      } disabled:opacity-50 cursor-pointer`}
                    >
                      Mark {st}
                    </button>
                  ))}
                  {issue.status !== 'Rejected' && (
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={isUpdatingStatus}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-[#F5C2BE] text-[#9E2A2B] hover:bg-[#FBE8E8] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Reject Issue
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Potential Duplicates Flagged by AI & Manual Merge */}
            {pendingDuplicates.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#FFF9E6] border border-[#F5E296] space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F5E296]/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FAF0DE] border border-[#EEDBBA] text-[#865917] flex items-center justify-center shrink-0">
                      <GitMerge className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#865917] flex items-center gap-2">
                        <span>Potential Duplicate Complaints Flagged by AI ({pendingDuplicates.length})</span>
                      </h3>
                      <p className="text-xs text-[#865917]/80">
                        AI identified similar incident reports nearby. Review match confidence scores and merge them into this consolidated master issue.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#865917] bg-[#FAF0DE] px-2.5 py-1 rounded-full border border-[#EEDBBA] self-start sm:self-center">
                    Action Required
                  </span>
                </div>

                <div className="space-y-3">
                  {pendingDuplicates.map((pot) => {
                    const confPct = Math.round((pot.confidence || 0) * 100);
                    return (
                      <div
                        key={pot.complaintId}
                        className="p-3.5 bg-white rounded-xl border border-[#F5E296] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-[#191B1D]">
                              #{pot.complaintId}
                            </span>
                            <span className="text-[11px] font-mono font-bold text-[#865917] bg-[#FBF1D8] border border-[#F5E296] px-2.5 py-0.5 rounded-full">
                              {confPct}% Match Confidence
                            </span>
                            {pot.flaggedAt && (
                              <span className="text-[11px] text-[#7E828B]">
                                Flagged {new Date(pot.flaggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#4B4E54] leading-relaxed">
                            {pot.matchReason || 'Geographic proximity and category correlation detected.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setSelectedComplaintId(pot.complaintId)}
                            className="px-3 py-1.5 rounded-full border border-[#E6E5DE] hover:bg-[#F0EFEA] text-xs font-medium text-[#191B1D] transition-colors cursor-pointer"
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => handleResolveDuplicate(pot.complaintId, 'Confirm')}
                            disabled={resolvingComplaintId === pot.complaintId}
                            className="px-4 py-1.5 rounded-full bg-[#191B1D] hover:bg-[#333] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <GitMerge className="w-3.5 h-3.5 text-[#D2E873]" />
                            <span>{resolvingComplaintId === pot.complaintId ? 'Merging...' : 'Confirm & Merge'}</span>
                          </button>
                          <button
                            onClick={() => handleResolveDuplicate(pot.complaintId, 'Dismiss')}
                            disabled={resolvingComplaintId === pot.complaintId}
                            className="px-3 py-1.5 rounded-full bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#4B4E54] text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Core Info Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  Responsible Unit
                </span>
                <p className="font-semibold text-sm text-[#191B1D] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#3E7295]" />
                  {issue.assignedDepartment || issue.department}
                </p>
                <span className="text-[10px] text-[#7E828B] block truncate">
                  {issue.assignedOfficer?.name
                    ? `Officer: ${issue.assignedOfficer.name}`
                    : 'Field Unit Unassigned'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  Location &amp; Coordinates
                </span>
                <p className="font-medium text-sm text-[#191B1D] flex items-center gap-1.5 truncate">
                  <MapPin className="w-4 h-4 text-[#8CA81F]" />
                  {issue.location?.address || 'City zone'}
                </p>
                {issue.location?.latitude && (
                  <span className="text-[10px] font-mono text-[#7E828B] block">
                    {issue.location.latitude.toFixed(4)}, {issue.location.longitude.toFixed(4)}
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  Citizen Collective Endorsements
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-[#191B1D] block">
                      {issue.supportingReportCount || associatedComplaints.length} Report(s)
                    </span>
                    <span className="text-[10px] text-[#7E828B]">
                      {issue.citizenSupportCount || 0} Affected Citizen(s)
                    </span>
                  </div>
                  {issue.status === 'Resolved' || issue.status === 'Resolution Submitted' ? (
                    <div className="flex items-center gap-1.5 bg-[#F0EFEA] p-1 rounded-full border border-[#E6E5DE] text-xs">
                      <button
                        onClick={() => handleVerificationVote('Confirmed')}
                        disabled={isVerifying}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 bg-[#3E520A] text-white hover:bg-[#2F3E07] transition-all disabled:opacity-50"
                        title="Confirm this civic issue is resolved"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Confirm Resolved</span>
                      </button>
                      <button
                        onClick={() => handleVerificationVote('Disputed')}
                        disabled={isVerifying}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 bg-white border border-[#E6E5DE] text-[#9E2A2B] hover:bg-[#FBE8E8] transition-all disabled:opacity-50"
                        title="Dispute resolution - issue still exists"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Still Exists</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleEndorse}
                      disabled={isEndorsing || issue.hasSupported}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        issue.hasSupported
                          ? 'bg-[#E3ECE1] text-[#365734] cursor-default'
                          : 'bg-[#D2E873] hover:bg-[#c2dc5a] text-[#191B1D] cursor-pointer'
                      }`}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {issue.hasSupported ? 'Endorsed' : 'I am affected'}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  SLA Target Deadline
                </span>
                <p className="font-medium text-sm text-[#191B1D] flex items-center gap-1.5">
                  <Hourglass className="w-4 h-4 text-[#7E828B]" />
                  {sla.deadline ? new Date(sla.deadline).toLocaleDateString() : 'Unscheduled'}
                </p>
                <span className="text-[10px] font-mono text-[#7E828B] block">
                  {sla.statusLabel || 'Set deadline below'}
                </span>
              </div>
            </div>
          </div>

          {/* 5. DEPARTMENT & OFFICER ASSIGNMENT CONSOLE (PHASE 5 REQUIREMENT) */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#191B1D]" />
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Department Dispatch &amp; Officer Assignment
                </h3>
              </div>
              <span className="text-[11px] text-[#7E828B]">
                {officerDirectory.disclaimer}
              </span>
            </div>

            <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#191B1D] block">
                  Target Municipal Department
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setSelectedOfficerId('');
                  }}
                  className="w-full bg-[#F9F9F6] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] text-xs focus:outline-none focus:border-[#191B1D]"
                >
                  {officerDirectory.departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#191B1D] block">
                  Responsible Officer (Demo Directory)
                </label>
                <select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  className="w-full bg-[#F9F9F6] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] text-xs focus:outline-none focus:border-[#191B1D]"
                >
                  <option value="">-- Select Field Officer --</option>
                  {deptOfficers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#191B1D] block">
                  SLA Target Window (Hours)
                </label>
                <input
                  type="number"
                  placeholder={
                    priority?.level === 'Critical'
                      ? '24h (Critical default)'
                      : priority?.level === 'High'
                      ? '72h (High default)'
                      : '168h (7 days default)'
                  }
                  value={customSlaHours}
                  onChange={(e) => setCustomSlaHours(e.target.value)}
                  className="w-full bg-[#F9F9F6] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] text-xs focus:outline-none focus:border-[#191B1D]"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full justify-center"
                  disabled={isAssigning}
                >
                  {isAssigning ? 'Dispatching...' : 'Dispatch & Set SLA'}
                </Button>
              </div>
            </form>

            {issue.assignedOfficer?.name && (
              <div className="p-3 bg-[#F9F9F6] rounded-xl border border-[#E6E5DE] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#3E520A]" />
                  <span className="font-semibold text-[#191B1D]">
                    Assigned Lead: {issue.assignedOfficer.name}
                  </span>
                  <span className="text-[10px] bg-[#E9F3C6] text-[#3E520A] px-2 py-0.5 rounded-full font-mono">
                    {issue.assignedOfficer.role}
                  </span>
                </div>
                <span className="text-[10px] text-[#7E828B]">
                  Dispatched on: {issue.assignedAt ? new Date(issue.assignedAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            )}
          </div>

          {/* 6. BEFORE & AFTER RESOLUTION EVIDENCE (PHASE 5 CORE FEATURE) */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#3E7295]" />
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Resolution Evidence &amp; Before/After Verification
                </h3>
              </div>
              <span className="text-xs text-[#7E828B]">
                Side-by-side verification: Intake photograph vs. Completed municipal work
              </span>
            </div>

            {/* Side-by-Side Comparison Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BEFORE: Original Intake Photograph */}
              <div className="space-y-3 p-4 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#9E2A2B] bg-[#FBE8E8] px-2.5 py-1 rounded-full border border-[#F5C2BE]">
                    BEFORE &bull; Citizen Intake Evidence
                  </span>
                  <span className="text-[11px] text-[#7E828B]">
                    {originalIntakeImages.length} image(s) recorded
                  </span>
                </div>

                {originalIntakeImages.length > 0 ? (
                  <div className="space-y-2">
                    <div
                      className="aspect-4/3 rounded-xl overflow-hidden border border-[#E6E5DE] bg-black/5 cursor-pointer relative group"
                      onClick={() => setPreviewImage(originalIntakeImages[0].url)}
                    >
                      <img
                        src={originalIntakeImages[0].url}
                        alt="Before evidence"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                        <Eye className="w-4 h-4" /> Click to enlarge
                      </div>
                    </div>
                    <p className="text-[11px] text-[#4B4E54] italic">
                      &ldquo;{originalIntakeImages[0].description}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="aspect-4/3 rounded-xl border border-dashed border-[#E6E5DE] flex flex-col items-center justify-center text-xs text-[#7E828B] p-4 text-center">
                    <ImageIcon className="w-8 h-8 text-[#CCCBBF] mb-1" />
                    <span>No initial photograph uploaded with this complaint.</span>
                  </div>
                )}
              </div>

              {/* AFTER: Resolution Evidence Uploaded by Officers */}
              <div className="space-y-3 p-4 rounded-2xl bg-[#F3F8D8] border border-[#D2E873]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#3E520A] bg-white px-2.5 py-1 rounded-full border border-[#D2E873]">
                    AFTER &bull; Resolution Evidence
                  </span>
                  <span className="text-[11px] text-[#3E520A] font-medium">
                    {resolutionEvidence.length} completion photo(s)
                  </span>
                </div>

                {resolutionEvidence.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const latestEvidence = resolutionEvidence[resolutionEvidence.length - 1];
                      return (
                        <>
                          <div
                            className="aspect-4/3 rounded-xl overflow-hidden border border-[#D2E873] bg-black/5 cursor-pointer relative group"
                            onClick={() => setPreviewImage(latestEvidence.url)}
                          >
                            <img
                              src={latestEvidence.url}
                              alt="After evidence"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                              <Eye className="w-4 h-4" /> Click to enlarge
                            </div>
                          </div>
                          <p className="text-[11px] text-[#3E520A] font-medium">
                            {issue.resolutionDescription || 'Remediation completed by municipal field unit.'}
                          </p>
                          <span className="text-[10px] text-[#5A7314] block">
                            Uploaded by: {latestEvidence.uploadedBy} &bull; {new Date(latestEvidence.uploadedAt).toLocaleDateString()}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="aspect-4/3 rounded-xl border border-dashed border-[#D2E873] flex flex-col items-center justify-center text-xs text-[#3E520A] p-4 text-center bg-white/40">
                    <CheckCircle2 className="w-8 h-8 text-[#A8C738] mb-1" />
                    <span>No completion evidence uploaded yet.</span>
                    <span className="text-[10px] text-[#5A7314] mt-0.5">Use upload form below once field work concludes.</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Visual Resolution Assessment (Advisory Check) */}
            {issue?.aiResolutionAssessment && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-white to-[#F9F9F6] border border-[#E6E5DE] shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#F0EFEA]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#8CA81F]" />
                    <span className="font-semibold text-xs text-[#191B1D]">
                      AI Visual Resolution Assessment
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {issue.aiResolutionAssessment.appearsFixed !== null ? (
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono border ${
                          issue.aiResolutionAssessment.appearsFixed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : issue.aiResolutionAssessment.repairQuality === 'Partial'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {issue.aiResolutionAssessment.appearsFixed
                          ? `✓ Appears Fixed (${issue.aiResolutionAssessment.confidenceScore}% Confidence)`
                          : issue.aiResolutionAssessment.repairQuality === 'Partial'
                          ? `⚠ Partial Fix (${issue.aiResolutionAssessment.confidenceScore}% Confidence)`
                          : `✕ Defect May Persist (${issue.aiResolutionAssessment.confidenceScore}% Confidence)`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {issue.aiResolutionAssessment.repairQuality || 'Pending Check'}
                      </span>
                    )}

                    {resolutionEvidence.length > 0 && (
                      <button
                        type="button"
                        onClick={handleTriggerAiAssessment}
                        disabled={isAssessingResolution}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5A7314] hover:text-[#3E520A] bg-white border border-[#E6E5DE] px-2 py-0.5 rounded-md hover:bg-[#F9F9F6] transition-colors disabled:opacity-50"
                        title="Re-run AI comparative analysis on before/after photos"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isAssessingResolution ? 'animate-spin' : ''}`} />
                        <span>{isAssessingResolution ? 'Analyzing...' : 'Re-evaluate'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#191B1D] font-medium leading-relaxed">
                  {issue.aiResolutionAssessment.summary || 'AI has evaluated the photographic evidence.'}
                </p>

                {issue.aiResolutionAssessment.observations?.length > 0 && (
                  <ul className="text-[11px] text-[#4B4E54] space-y-0.5 pl-4 list-disc">
                    {issue.aiResolutionAssessment.observations.map((obs, idx) => (
                      <li key={idx} className="leading-normal">{obs}</li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-1.5 pt-1 border-t border-[#F0EFEA] text-[10px] text-[#7E828B]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5A7314] shrink-0" />
                  <span>
                    <strong>Human-in-the-Loop Safeguard:</strong> This AI assessment is purely advisory. Citizens retain the final authority to confirm or dispute this resolution below.
                  </span>
                </div>
              </div>
            )}

            {/* Officer Evidence Upload Form */}
            <form onSubmit={handleUploadEvidence} className="p-4 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-3">
              <span className="text-xs font-semibold text-[#191B1D] block flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#191B1D]" /> Upload Completed Work Photograph Evidence
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#7E828B]">Select Photograph(s) (JPEG/PNG, max 5MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setEvidenceFiles(e.target.files)}
                    className="w-full bg-white border border-[#E6E5DE] rounded-xl px-3 py-1.5 text-xs text-[#191B1D]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[#7E828B]">Authorizing / Uploading Officer</label>
                  <input
                    type="text"
                    placeholder={issue.assignedOfficer?.name || 'Officer Name'}
                    value={evidenceOfficer}
                    onChange={(e) => setEvidenceOfficer(e.target.value)}
                    className="w-full bg-white border border-[#E6E5DE] rounded-xl px-3 py-1.5 text-xs text-[#191B1D]"
                  />
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <label className="text-[11px] text-[#7E828B]">Work Performed Description &amp; Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="Describe physical remediation completed (e.g. Asphalting and grade leveling completed on Oak St; water valve replacement tested at 45 PSI)..."
                  value={resolutionDescription}
                  onChange={(e) => setResolutionDescription(e.target.value)}
                  className="w-full bg-white border border-[#E6E5DE] rounded-xl p-2.5 text-xs text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Upload}
                  disabled={isUploadingEvidence}
                >
                  {isUploadingEvidence ? 'Uploading & Transitioning...' : 'Submit Resolution Evidence'}
                </Button>
              </div>
            </form>
          </div>

          {/* 7. CITIZEN RESOLUTION VERIFICATION PANEL */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#3E520A]" />
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Citizen Resolution Verification Status
                </h3>
              </div>
              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                  verification.status === 'Confirmed'
                    ? 'bg-[#E3ECE1] text-[#365734]'
                    : verification.status === 'Disputed'
                    ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                    : 'bg-[#FFF9E6] text-[#865917]'
                }`}
              >
                Verification: {verification.status || 'Pending'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#F3F8D8] border border-[#D2E873] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#3E520A] block">
                  Citizen Confirmations
                </span>
                <span className="font-editorial text-2xl font-bold text-[#3E520A]">
                  {verification.confirmedCount || 0}
                </span>
                <span className="text-[10px] text-[#5A7314] block">Verified resolved by residents</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#FBE8E8] border border-[#F5C2BE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#9E2A2B] block">
                  Disputed Reports
                </span>
                <span className="font-editorial text-2xl font-bold text-[#9E2A2B]">
                  {verification.disputedCount || 0}
                </span>
                <span className="text-[10px] text-[#9E2A2B] block">Citizens report issue persists</span>
              </div>

              <div className="p-3 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                  Authority Finalization
                </span>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleStatusChange('Resolved', 'Final resolution sign-off by municipal authority')}
                    disabled={issue.status === 'Resolved'}
                    className="px-3 py-1 rounded-full bg-[#191B1D] text-white hover:bg-[#333] text-[11px] font-medium disabled:opacity-50 cursor-pointer"
                  >
                    Confirm &amp; Close Issue
                  </button>
                  <button
                    onClick={() => handleStatusChange('In Progress', 'Re-opened after disputed citizen verification')}
                    className="px-3 py-1 rounded-full bg-[#F0EFEA] border border-[#E6E5DE] text-[#191B1D] hover:bg-[#E6E5DE] text-[11px] font-medium cursor-pointer"
                  >
                    Reopen for Work
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 8. CONFIDENTIAL INTERNAL AUTHORITY NOTES (PHASE 5 REQUIREMENT) */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#865917]" />
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Internal Authority Operational Notes
                </h3>
                <span className="text-[10px] bg-[#FFF9E6] text-[#865917] border border-[#F5E296] px-2 py-0.5 rounded-full font-medium">
                  Confidential &bull; Authority Eyes Only
                </span>
              </div>
              <span className="text-xs text-[#7E828B]">
                {internalNotes.length} note(s) logged
              </span>
            </div>

            {/* Note Entry Form */}
            <form onSubmit={handleAddNote} className="space-y-2 text-xs">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Record confidential operational directive, contractor contact, or engineering note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 bg-[#F9F9F6] border border-[#E6E5DE] rounded-xl px-3 py-2 text-xs text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  disabled={isSubmittingNote || !newNote.trim()}
                >
                  Post Note
                </Button>
              </div>
            </form>

            {/* Existing Notes List */}
            <div className="space-y-2">
              {internalNotes.length > 0 ? (
                internalNotes.map((n, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-[#FFFDF7] border border-[#F5E296]/60 text-xs text-[#191B1D] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-[11px] text-[#865917] block">
                        {n.author}
                      </span>
                      <p className="text-[#4B4E54]">{n.note}</p>
                    </div>
                    <span className="text-[10px] text-[#7E828B] font-mono whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-[#7E828B]">
                  No internal notes recorded yet.
                </div>
              )}
            </div>
          </div>

          {/* 9. ACTIVITY TIMELINE & AUDIT LOG (PHASE 5 REQUIREMENT) */}
          <div className="p-6 rounded-3xl bg-white border border-[#E6E5DE] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#191B1D]" />
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Operational Activity Timeline &amp; Audit Trail
                </h3>
              </div>
              <span className="text-xs text-[#7E828B]">
                Immutable chronological event log
              </span>
            </div>

            {loadingActivities ? (
              <div className="py-6 text-center text-xs text-[#7E828B]">Loading audit logs...</div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act._id || act.timestamp}
                    className="flex items-start gap-3 text-xs p-3.5 rounded-2xl bg-[#F9F9F6] border border-[#E6E5DE]"
                  >
                    <div className="mt-1 w-2.5 h-2.5 rounded-full bg-[#191B1D]" />
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#191B1D]">{act.eventType}</span>
                          {act.isInternal && (
                            <span className="text-[9px] bg-[#FFF9E6] text-[#865917] px-1.5 py-0.2 rounded font-mono">
                              INTERNAL
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#7E828B] font-mono">
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#4B4E54]">{act.description}</p>
                      <span className="text-[10px] text-[#7E828B] block">
                        Actor: {act.actor}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#7E828B]">
                No operational activity recorded for this issue.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 10. REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-[#E6E5DE] shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-[#9E2A2B]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-editorial text-xl">Reject Master Issue</h3>
            </div>
            <p className="text-xs text-[#7E828B] leading-relaxed">
              Municipal SLA regulations require a specific official justification when closing a civic grievance without dispatch.
            </p>
            <textarea
              rows={3}
              placeholder="State official rejection rationale (e.g. Private property jurisdiction; duplicate of work order #WO-402; unverified location)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-[#F9F9F6] border border-[#E6E5DE] rounded-xl p-3 text-xs text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!rejectionReason.trim()}
                onClick={() => handleStatusChange('Rejected', null, rejectionReason.trim())}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 11. LIGHTBOX PREVIEW */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-3xl max-h-[90vh] bg-white rounded-3xl overflow-hidden p-2 relative shadow-2xl">
            <img
              src={previewImage}
              alt="Evidence preview"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-2xl"
            />
            <div className="p-3 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewImage(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
