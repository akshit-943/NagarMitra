import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import CivicMap from '../components/CivicMap';
import { useCivic } from '../context/CivicContext';
import { verifyMasterIssueResolution } from '../services/complaintService';
import {
  PlusCircle,
  MapPin,
  Clock,
  Sparkles,
  Map as MapIcon,
  List as ListIcon,
  Search,
  ExternalLink,
  RefreshCw,
  Database,
  Image as ImageIcon,
  ThumbsUp,
  Layers,
  Flame,
  Bookmark,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export default function CitizenDashboard() {
  const {
    complaints,
    masterIssues,
    hotspots,
    endorseIssue,
    loading,
    error,
    pagination,
    setIsSubmitModalOpen,
    setSelectedComplaintId,
    fetchLiveComplaints,
    isCitizenAuthenticated,
    followedIssues,
    toggleFollowIssue,
    setActiveTab,
  } = useCivic();

  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeView, setActiveView] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [endorsingId, setEndorsingId] = useState(null);
  const [verificationMap, setVerificationMap] = useState({});
  const [verifyingMap, setVerifyingMap] = useState({});
  const [verificationToast, setVerificationToast] = useState(null);

  const handleVerifyResolution = async (masterIssueId, decision) => {
    if (!masterIssueId) return;
    setVerifyingMap((prev) => ({ ...prev, [masterIssueId]: true }));
    try {
      const res = await verifyMasterIssueResolution(masterIssueId, { response: decision });
      setVerificationMap((prev) => ({ ...prev, [masterIssueId]: decision }));
      setVerificationToast({
        id: masterIssueId,
        type: 'success',
        text: res.message || `Verification recorded: ${decision === 'Confirmed' ? 'Confirmed Resolved' : 'Reported Still Exists'}`,
      });
    } catch (err) {
      if (err.response?.status === 409) {
        setVerificationMap((prev) => ({ ...prev, [masterIssueId]: decision }));
        setVerificationToast({
          id: masterIssueId,
          type: 'info',
          text: 'You have already submitted verification feedback for this issue.',
        });
      } else {
        setVerificationToast({
          id: masterIssueId,
          type: 'error',
          text: err.response?.data?.message || err.message || 'Could not record verification.',
        });
      }
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [masterIssueId]: false }));
      setTimeout(() => setVerificationToast(null), 5000);
    }
  };

  const handleQuickEndorse = async (masterIssueId) => {
    if (!masterIssueId) return;
    try {
      setEndorsingId(masterIssueId);
      const res = await endorseIssue(masterIssueId);
      alert(res.message || 'Support registered!');
    } catch (err) {
      alert(err.message || 'Already supported');
    } finally {
      setEndorsingId(null);
    }
  };

  const categories = [
    'All',
    'Roadways & Pavement',
    'Water & Sanitation',
    'Electrical & Lighting',
    'Sanitation & Waste',
    'Parks & Public Realm',
  ];

  // Refetch when filters change
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    fetchLiveComplaints({
      category: cat === 'All' ? undefined : cat,
      status: activeStatus === 'All' ? undefined : activeStatus,
      search: searchQuery || undefined,
    });
  };

  const handleStatusChange = (status) => {
    setActiveStatus(status);
    fetchLiveComplaints({
      category: activeCategory === 'All' ? undefined : activeCategory,
      status: status === 'All' ? undefined : status,
      search: searchQuery || undefined,
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLiveComplaints({
      category: activeCategory === 'All' ? undefined : activeCategory,
      status: activeStatus === 'All' ? undefined : activeStatus,
      search: searchQuery || undefined,
    });
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

  // Compute live counts
  const pendingCount = complaints.filter((c) => c.status === 'Pending' || c.status === 'Under Review').length;
  const activeCount = complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected').length;
  const resolvedCount = complaints.filter((c) => c.status === 'Resolved').length;

  // Filter complaints accurately according to status specifications
  const displayedComplaints = React.useMemo(() => {
    return complaints.filter((c) => {
      if (activeCategory !== 'All' && c.category !== activeCategory) return false;
      if (activeStatus === 'Active') return c.status !== 'Resolved' && c.status !== 'Rejected';
      if (activeStatus === 'Pending') return c.status === 'Pending' || c.status === 'Under Review';
      if (activeStatus === 'Resolved') return c.status === 'Resolved';
      if (activeStatus === 'Rejected') return c.status === 'Rejected';
      return true;
    });
  }, [complaints, activeCategory, activeStatus]);

  return (
    <div className="space-y-8 py-2">
      {/* 1. PROMINENT COMPLAINT SUBMISSION HERO CARD */}
      <div className="rounded-3xl bg-[#ECE8F9] border border-[#DDD7F4] p-6 sm:p-9 relative overflow-hidden">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="lavender" size="sm" dot>
              Citizen Incident Dispatch
            </Badge>
            <span className="text-[11px] font-mono text-[#55478A] flex items-center gap-1">
              <Database className="w-3 h-3" /> Live Registry Connected
            </span>
          </div>

          <h1 className="font-editorial text-3xl sm:text-4xl text-[#191B1D] font-normal leading-tight">
            See a problem in your neighborhood? Report it immediately.
          </h1>

          <p className="text-xs sm:text-sm text-[#55478A] max-w-xl leading-relaxed">
            From water pipeline breaks and hazardous potholes to damaged signals. Submissions are securely stored in the municipal database and routed to on-duty crews.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={PlusCircle}
              onClick={() => setIsSubmitModalOpen(true)}
              className="shadow-sm font-semibold"
            >
              Submit New Complaint
            </Button>
            <span className="text-xs text-[#55478A]">
              Real-time tracking with unique ID
            </span>
          </div>
        </div>

        {/* Quick shortcut tags */}
        <div className="mt-6 pt-5 border-t border-[#DDD7F4]/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#55478A] font-medium mr-1">Frequent:</span>
          {['Water Main Leak', 'Damaged Pavement', 'Streetlight Out', 'Illegal Dumping'].map((tag) => (
            <button
              key={tag}
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-3 py-1 rounded-full bg-white/70 hover:bg-white text-[#191B1D] border border-[#DDD7F4] transition-colors text-[11px]"
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CITIZEN OVERVIEW STATS (CALCULATED FROM LIVE RECORDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card variant="white" padding="default">
          <span className="text-xs text-[#7E828B] font-medium block">Total Live Registry</span>
          <span className="font-editorial text-3xl text-[#191B1D] mt-1 block">
            {pagination.total}
          </span>
          <span className="text-xs text-[#4B4E54] mt-1 block">Stored complaints</span>
        </Card>

        <Card variant="warm" padding="default">
          <span className="text-xs text-[#865917] font-semibold block">Pending Triage</span>
          <span className="font-editorial text-3xl text-[#191B1D] mt-1 block">
            {pendingCount}
          </span>
          <span className="text-xs text-[#865917] mt-1 block">Awaiting inspection</span>
        </Card>

        <Card variant="lime" padding="default">
          <span className="text-xs text-[#3E520A] font-semibold block">Active Unresolved</span>
          <span className="font-editorial text-3xl text-[#191B1D] mt-1 block">
            {activeCount}
          </span>
          <span className="text-xs text-[#3E520A] mt-1 block">Triage & field repair</span>
        </Card>

        <Card variant="sage" padding="default">
          <span className="text-xs text-[#365734] font-semibold block">Resolved</span>
          <span className="font-editorial text-3xl text-[#191B1D] mt-1 block">
            {resolvedCount}
          </span>
          <span className="text-xs text-[#365734] mt-1 block">Repairs completed</span>
        </Card>
      </div>

      {/* 3. CONTROLS, SEARCH, AND VIEW TOGGLE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-[#191B1D] text-white'
                    : 'bg-white border border-[#E6E5DE] text-[#4B4E54] hover:bg-[#F0EFEA]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search & View Toggle */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7E828B]" />
              <input
                type="text"
                placeholder="Search ID or street..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E6E5DE] rounded-full text-[#191B1D] placeholder-[#A2A6B0] focus:outline-none focus:border-[#191B1D] w-44 sm:w-52"
              />
            </form>

            <button
              onClick={() => fetchLiveComplaints()}
              className="p-1.5 rounded-full bg-white border border-[#E6E5DE] text-[#7E828B] hover:text-[#191B1D]"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center bg-white border border-[#E6E5DE] rounded-full p-0.5">
              <button
                onClick={() => setActiveView('list')}
                className={`p-1.5 rounded-full ${
                  activeView === 'list' ? 'bg-[#191B1D] text-white' : 'text-[#7E828B] hover:text-[#191B1D]'
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveView('map')}
                className={`p-1.5 rounded-full ${
                  activeView === 'map' ? 'bg-[#191B1D] text-white' : 'text-[#7E828B] hover:text-[#191B1D]'
                }`}
                title="Map View"
              >
                <MapIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status sub-filter */}
        <div className="flex items-center gap-2 text-xs text-[#7E828B] overflow-x-auto pb-1">
          <span>Status Filter:</span>
          {['All', 'Active', 'Pending', 'Resolved', 'Rejected'].map((st) => (
            <button
              key={st}
              onClick={() => handleStatusChange(st)}
              className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                activeStatus === st ? 'bg-[#191B1D] text-white' : 'hover:text-[#191B1D]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 4. CONTENT AREA: MAP OR LIST */}
      {loading && complaints.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-[#191B1D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#7E828B]">Retrieving complaints from MongoDB registry...</p>
        </div>
      ) : activeView === 'map' ? (
        <div className="space-y-4">
          <CivicMap
            mode="public"
            showResolved={activeStatus === 'Resolved' || activeStatus === 'All'}
            issues={displayedComplaints
              .filter((c) => c.location?.latitude && c.location?.longitude)
              .map((c) => ({
                ...c,
                id: c.complaintId,
                title: c.category,
                location: c.location?.address || 'Community area',
                coordinates: [Number(c.location.latitude), Number(c.location.longitude)],
                supportingReportCount: c.isMasterIssuePrimary ? 2 : 1,
              }))}
            hotspots={hotspots}
            showHotspots={true}
            height="520px"
            onSelectIssue={(issue) => setSelectedComplaintId(issue.complaintId || issue.id)}
          />
          <p className="text-xs text-[#7E828B] text-center">
            Click any pin to inspect the live report and open details. Shaded circles indicate geographical civic hotspots.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedComplaints.length === 0 ? (
            <Card variant="white" padding="lg" className="text-center py-12 space-y-3">
              <p className="text-sm font-medium text-[#191B1D]">No complaints found in the registry for this criteria.</p>
              <p className="text-xs text-[#7E828B] max-w-sm mx-auto">
                Be the first to file a neighborhood report using the submission button above.
              </p>
              <Button variant="primary" size="sm" onClick={() => setIsSubmitModalOpen(true)}>
                File First Report
              </Button>
            </Card>
          ) : (
            displayedComplaints.map((complaint) => (
              <Card
                key={complaint.complaintId || complaint._id}
                variant="white"
                padding="default"
                className="transition-all hover:border-[#191B1D]/40 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-medium text-[#191B1D] bg-[#F0EFEA] px-2.5 py-0.5 rounded-md">
                      {complaint.complaintId}
                    </span>
                    <Badge variant={getStatusBadgeVariant(complaint.status)} size="sm" dot>
                      {complaint.status}
                    </Badge>
                    <Badge variant="neutral" size="sm">
                      {complaint.category}
                    </Badge>
                    {complaint.aiAnalysis?.analysisStatus === 'Completed' ? (
                      <span className="text-[11px] font-mono text-[#3E520A] bg-[#E9F3C6] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium border border-[#D2E873]">
                        <Sparkles className="w-3 h-3 text-[#5A7314]" />
                        AI Severity: {complaint.aiAnalysis.severityScore}/100 ({complaint.severity || complaint.aiAnalysis.severityLevel})
                      </span>
                    ) : complaint.aiAnalysis?.analysisStatus === 'Processing' ? (
                      <span className="text-[11px] font-mono text-[#55478A] bg-[#ECE8F9] px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse border border-[#DDD7F4]">
                        <Sparkles className="w-3 h-3 text-[#55478A]" />
                        AI Analyzing...
                      </span>
                    ) : null}
                    {complaint.masterIssueId && (
                      <span className="text-[11px] font-mono text-[#55478A] bg-[#ECE8F9] px-2 py-0.5 rounded-md flex items-center gap-1 font-medium border border-[#DDD7F4]">
                        <Layers className="w-3 h-3 text-[#55478A]" />
                        {complaint.masterIssueId}
                      </span>
                    )}
                    {complaint.aiAnalysis?.requiresHumanReview && (
                      <Badge variant="warm" size="sm">
                        Review Needed
                      </Badge>
                    )}
                    {complaint.imageUrl && (
                      <span className="text-[11px] text-[#3E7295] flex items-center gap-1 font-medium">
                        <ImageIcon className="w-3 h-3" /> Photo Attached
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#7E828B] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(complaint.createdAt).toLocaleDateString()} at{' '}
                    {new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-[#191B1D] font-medium leading-relaxed">
                    {complaint.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E6E5DE] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4 text-[#7E828B]">
                    <span className="flex items-center gap-1 text-[#191B1D] font-medium">
                      <MapPin className="w-3.5 h-3.5 text-[#3E7295]" />
                      {complaint.location?.address}
                    </span>
                    <span>Routing: {complaint.department}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {complaint.masterIssueId && (
                      <>
                        {complaint.status === 'Resolved' || complaint.status === 'Resolution Submitted' ? (
                          verificationMap[complaint.masterIssueId] === 'Confirmed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3F8D8] border border-[#D2E873] text-[#3E520A] font-semibold text-xs">
                              <CheckCircle className="w-3.5 h-3.5 text-[#3E520A]" />
                              <span>Confirmed Resolved</span>
                            </span>
                          ) : verificationMap[complaint.masterIssueId] === 'Disputed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBE8E8] border border-[#F5C2BE] text-[#9E2A2B] font-semibold text-xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-[#9E2A2B]" />
                              <span>Reported Still Exists</span>
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-[#F0EFEA] p-1 rounded-full border border-[#E6E5DE] text-xs">
                              <span className="text-[10px] uppercase font-semibold text-[#7E828B] px-1 hidden sm:inline">Confirm Fix:</span>
                              <button
                                onClick={() => handleVerifyResolution(complaint.masterIssueId, 'Confirmed')}
                                disabled={verifyingMap[complaint.masterIssueId]}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3E520A] hover:bg-[#2F3E07] text-white font-semibold text-xs transition-colors disabled:opacity-50"
                                title="Confirm this civic issue has been resolved on site"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Confirm Resolved</span>
                              </button>
                              <button
                                onClick={() => handleVerifyResolution(complaint.masterIssueId, 'Disputed')}
                                disabled={verifyingMap[complaint.masterIssueId]}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white hover:bg-[#FBE8E8] text-[#9E2A2B] border border-[#E6E5DE] font-semibold text-xs transition-colors disabled:opacity-50"
                                title="Report that this issue is NOT resolved / still exists"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Still Exists</span>
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => handleQuickEndorse(complaint.masterIssueId)}
                            disabled={endorsingId === complaint.masterIssueId}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191B1D] hover:bg-[#333] text-white font-medium text-xs transition-colors disabled:opacity-50"
                            title="I am also affected by this issue"
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>I'm Affected</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (!isCitizenAuthenticated) {
                              setActiveTab('citizen-entry');
                            } else {
                              toggleFollowIssue(complaint.masterIssueId);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-xs transition-colors border ${
                            followedIssues?.some((f) => (f.masterIssueId || f) === complaint.masterIssueId)
                              ? 'bg-[#F2F8D5] border-[#D2E873] text-[#3E520A]'
                              : 'bg-white border-[#E6E5DE] text-[#4B4E54] hover:border-[#191B1D]'
                          }`}
                          title="Follow this civic issue for notifications"
                        >
                          <Bookmark className="w-3 h-3" />
                          <span>
                            {followedIssues?.some((f) => (f.masterIssueId || f) === complaint.masterIssueId)
                              ? 'Following'
                              : 'Follow'}
                          </span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedComplaintId(complaint.complaintId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#191B1D] font-medium text-xs transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Inspect Details &amp; Timeline</span>
                    </button>
                  </div>
                </div>

                {verificationToast && verificationToast.id === complaint.masterIssueId && (
                  <div
                    className={`p-2 rounded-xl text-xs font-medium border ${
                      verificationToast.type === 'success'
                        ? 'bg-[#F3F8D8] border-[#D2E873] text-[#3E520A]'
                        : verificationToast.type === 'info'
                        ? 'bg-[#F0EFEA] border-[#E6E5DE] text-[#191B1D]'
                        : 'bg-[#FBE8E8] border-[#F5C2BE] text-[#9E2A2B]'
                    }`}
                  >
                    {verificationToast.text}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
