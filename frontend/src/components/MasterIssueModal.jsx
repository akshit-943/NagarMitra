import React, { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import Badge from './ui/Badge';
import { getMasterIssueById, updateMasterIssueStatus } from '../services/complaintService';
import { useCivic } from '../context/CivicContext';
import {
  MapPin,
  Building,
  ThumbsUp,
  AlertTriangle,
  ExternalLink,
  Clock,
  Check,
  Users,
  Image as ImageIcon,
  Maximize2,
} from 'lucide-react';

export default function MasterIssueModal({ masterIssueId, isOpen, onClose }) {
  const {
    setSelectedComplaintId,
    resolveDuplicateAction,
    fetchLiveMasterIssues,
    navigateToMasterIssue,
  } = useCivic();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [resolvingComplaintId, setResolvingComplaintId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const fetchDetails = async () => {
    if (!masterIssueId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMasterIssueById(masterIssueId);
      if (res.success && res.data) {
        setIssue(res.data);
      } else {
        setError(res.message || 'Unable to load master issue details');
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve master issue details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (masterIssueId && isOpen) {
      fetchDetails();
    }
  }, [masterIssueId, isOpen]);

  const handleStatusChange = async (newStatus) => {
    if (!issue?.masterIssueId) return;
    setIsUpdatingStatus(true);
    try {
      await updateMasterIssueStatus(issue.masterIssueId, {
        status: newStatus,
        note: `Status updated to ${newStatus} from Municipal Intelligence Console`,
      });
      await fetchDetails();
      fetchLiveMasterIssues();
    } catch (err) {
      alert(`Status update error: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleResolveDuplicate = async (complaintId, action) => {
    if (!issue?.masterIssueId) return;
    setResolvingComplaintId(complaintId);
    try {
      await resolveDuplicateAction(issue.masterIssueId, complaintId, action);
      await fetchDetails();
    } catch (err) {
      alert(`Duplicate resolution error: ${err.message}`);
    } finally {
      setResolvingComplaintId(null);
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'Resolved':
        return 'sage';
      case 'In Progress':
        return 'lime';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={issue ? `Master Issue ${issue.masterIssueId}` : 'Master Issue Details'}
      subtitle="Consolidated community incident record & dynamic priority intelligence"
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="py-12 text-center text-xs text-[#7E828B] space-y-2">
          <div className="w-6 h-6 border-2 border-[#191B1D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading master issue and associated reports...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-[#9E2B25] text-xs space-y-2">
          <p className="font-semibold">Unable to load master issue</p>
          <p>{error}</p>
        </div>
      ) : !issue ? null : (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F0EFEA] border border-[#E6E5DE]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#191B1D] bg-white px-2.5 py-0.5 rounded border border-[#E6E5DE]">
                  {issue.masterIssueId}
                </span>
                <Badge variant={getStatusBadgeVariant(issue.status)} size="md" dot>
                  {issue.status}
                </Badge>
                {priority && (
                  <span
                    className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                      priority.level === 'Critical'
                        ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                        : priority.level === 'High'
                        ? 'bg-[#FBF1D8] text-[#865917]'
                        : 'bg-[#F3F8D8] text-[#3E520A]'
                    }`}
                  >
                    Priority: {priority.score}/100 ({priority.level})
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-base text-[#191B1D]">{issue.title}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  navigateToMasterIssue(issue.masterIssueId);
                }}
                className="px-3 py-1 rounded-full bg-white border border-[#E6E5DE] hover:bg-[#E6E5DE] text-xs font-medium text-[#191B1D] transition-colors flex items-center gap-1"
                title="Open Dedicated Full Page View"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Full Page</span>
              </button>

              {/* Quick Status Dispatch Controls */}
              <div className="flex items-center gap-1.5 text-xs">
                {['Under Review', 'In Progress', 'Resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isUpdatingStatus || issue.status === st}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      issue.status === st
                        ? 'bg-[#191B1D] text-white cursor-default'
                        : 'bg-white border border-[#E6E5DE] text-[#4B4E54] hover:bg-[#E6E5DE]'
                    }`}
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Priority Explainability Breakdown */}
          {priority && (
            <div className="p-4 rounded-2xl bg-white border border-[#E6E5DE] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#191B1D] uppercase tracking-wider">
                    Dynamic Civic Priority Assessment Formula
                  </h4>
                  <p className="text-xs text-[#7E828B]">
                    Normalized composite calculation (Severity 40% + Safety 25% + Community 20% + Location 15%)
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-editorial text-2xl font-bold text-[#191B1D]">
                    {priority.score}
                  </span>
                  <span className="text-xs text-[#7E828B]"> / 100</span>
                </div>
              </div>

              {/* 4 Factor Contribution Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                    AI Severity (40%)
                  </span>
                  <div className="text-base font-bold text-[#191B1D]">
                    {breakdown.severityScore ?? 50}
                    <span className="text-[11px] font-normal text-[#7E828B]"> / 100</span>
                  </div>
                  <span className="text-[10px] text-[#7E828B] block truncate">
                    Tier: {issue.aiSeverity?.level || 'Medium'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                    Safety Risk (25%)
                  </span>
                  <div className="text-base font-bold text-[#191B1D]">
                    {breakdown.safetyScore ?? 50}
                    <span className="text-[11px] font-normal text-[#7E828B]"> / 100</span>
                  </div>
                  <span className="text-[10px] text-[#7E828B] block truncate">
                    Tier: {issue.safetyRisk?.level || 'Medium'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F3F8D8] border border-[#D2E873] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#3E520A] block">
                    Collective Impact (20%)
                  </span>
                  <div className="text-base font-bold text-[#3E520A]">
                    {breakdown.collectiveScore ?? 30}
                    <span className="text-[11px] font-normal text-[#5A7314]"> / 100</span>
                  </div>
                  <span className="text-[10px] text-[#3E520A] block truncate">
                    {issue.supportingReportCount} reports &bull; {issue.citizenSupportCount} endorsements
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                    Location Criticality (15%)
                  </span>
                  <div className="text-base font-bold text-[#191B1D]">
                    {breakdown.locationScore ?? 50}
                    <span className="text-[11px] font-normal text-[#7E828B]"> / 100</span>
                  </div>
                  <span className="text-[10px] text-[#7E828B] block truncate">
                    {issue.location?.locationType || 'Neutral Roadway'}
                  </span>
                </div>
              </div>

              {priority.explanation && (
                <div className="p-3 rounded-xl bg-[#F0EFEA] text-xs text-[#191B1D] italic leading-relaxed">
                  &ldquo;{priority.explanation}&rdquo;
                </div>
              )}
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[#7E828B]">Assigned Department</span>
              <p className="font-semibold text-[#191B1D] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#3E7295]" />
                {issue.department || 'Municipal Public Works'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[#7E828B]">Geographic Location</span>
              <p className="font-medium text-[#191B1D] flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#8CA81F]" />
                {issue.location?.address}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E6E5DE] space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[#7E828B]">Citizen Collective Support</span>
              <p className="font-semibold text-[#191B1D] flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-[#3E520A]" />
                {issue.citizenSupportCount} citizen(s) endorsed
              </p>
            </div>
          </div>

          {/* Potential Duplicates Awaiting Triage */}
          {pendingDuplicates.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#FFF9E6] border border-[#F5E296] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#865917]" />
                  <h4 className="font-semibold text-xs text-[#865917] uppercase tracking-wider">
                    Potential Duplicates Flagged for Review ({pendingDuplicates.length})
                  </h4>
                </div>
                <span className="text-xs text-[#865917]">Requires dispatcher sign-off</span>
              </div>

              <div className="space-y-2">
                {pendingDuplicates.map((pot) => (
                  <div
                    key={pot.complaintId}
                    className="p-3 bg-white rounded-xl border border-[#F5E296] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#191B1D]">{pot.complaintId}</span>
                        <span className="text-[11px] font-mono text-[#865917] bg-[#FBF1D8] px-2 py-0.2 rounded">
                          {Math.round(pot.confidence * 100)}% Match Confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7E828B]">{pot.matchReason}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedComplaintId(pot.complaintId)}
                        className="px-2.5 py-1 rounded-full border border-[#E6E5DE] hover:bg-[#F0EFEA] text-[11px] font-medium text-[#191B1D]"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => handleResolveDuplicate(pot.complaintId, 'Confirm')}
                        disabled={resolvingComplaintId === pot.complaintId}
                        className="px-3 py-1 rounded-full bg-[#3E520A] hover:bg-[#2F3E07] text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                      >
                        Confirm Duplicate
                      </button>
                      <button
                        onClick={() => handleResolveDuplicate(pot.complaintId, 'Dismiss')}
                        disabled={resolvingComplaintId === pot.complaintId}
                        className="px-3 py-1 rounded-full bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#191B1D] text-[11px] font-semibold transition-colors disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Associated Citizen Complaint Reports Gallery */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-xs text-[#191B1D] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#7E828B]" />
                Associated Citizen Incident Reports ({associatedComplaints.length})
              </h4>
              <span className="text-xs text-[#7E828B]">
                All individual records preserved independently in database
              </span>
            </div>

            <div className="space-y-2">
              {associatedComplaints.length > 0 ? (
                associatedComplaints.map((c) => (
                  <div
                    key={c.complaintId}
                    className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] hover:border-[#191B1D]/40 transition-colors space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#191B1D]">{c.complaintId}</span>
                        {c.complaintId === issue.primaryComplaintId ? (
                          <span className="text-[10px] bg-[#E9F3C6] text-[#3E520A] px-2 py-0.5 rounded font-medium">
                            Primary Anchor Report
                          </span>
                        ) : (
                          <span className="text-[10px] bg-[#F0EFEA] text-[#55478A] px-2 py-0.5 rounded font-medium">
                            Correlated Duplicate
                          </span>
                        )}
                        <Badge variant={getStatusBadgeVariant(c.status)} size="sm">
                          {c.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#7E828B]">
                        <span>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            setSelectedComplaintId(c.complaintId);
                          }}
                          className="hover:underline text-[#191B1D] font-medium flex items-center gap-1"
                        >
                          <span>Full Detail</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#191B1D] leading-relaxed">{c.description}</p>

                    <div className="text-[11px] text-[#7E828B] flex items-center justify-between pt-1 border-t border-[#E6E5DE]">
                      <span>{c.location?.address}</span>
                      {c.imageUrl && (
                        <button
                          onClick={() => setPreviewImage(c.imageUrl)}
                          className="text-[#3E7295] hover:underline font-medium flex items-center gap-1"
                        >
                          <ImageIcon className="w-3 h-3" /> View Photo
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#7E828B]">
                  No associated citizen reports loaded.
                </div>
              )}
            </div>
          </div>

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-[#E6E5DE] space-y-2">
              <span className="text-[10px] uppercase font-semibold text-[#7E828B] block">
                Status History
              </span>
              <div className="space-y-1.5 text-xs text-[#4B4E54]">
                {statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-[#F0EFEA] last:border-0">
                    <span>
                      {h.fromStatus ? `${h.fromStatus} → ` : ''}
                      <strong className="text-[#191B1D]">{h.toStatus}</strong>
                      {h.note ? ` (${h.note})` : ''}
                    </span>
                    <span className="text-[#7E828B] font-mono">
                      {new Date(h.changedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="max-w-2xl bg-white rounded-2xl p-2 shadow-2xl">
            <img src={previewImage} alt="Evidence" className="max-h-[75vh] rounded-xl object-contain" />
          </div>
        </div>
      )}
    </Modal>
  );
}
