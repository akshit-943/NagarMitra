import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useCivic } from '../context/CivicContext';
import {
  updateCitizenProfile,
  changeCitizenPassword,
} from '../services/complaintService';
import {
  LayoutDashboard,
  FileText,
  Link as LinkIcon,
  Bookmark,
  Bell,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  PlusCircle,
  Search,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function PersonalCitizenDashboard() {
  const {
    citizenUser,
    citizenOverview,
    myComplaints,
    followedIssues,
    citizenNotifications,
    unreadNotificationsCount,
    fetchCitizenOverview,
    fetchMyComplaints,
    claimComplaint,
    toggleFollowIssue,
    markNotificationRead,
    markAllNotificationsRead,
    logoutCitizenUser,
    setIsSubmitModalOpen,
    setSelectedComplaintId,
  } = useCivic();

  const [activeSection, setActiveSection] = useState('overview'); // 'overview', 'complaints', 'claim', 'followed', 'notifications', 'profile'

  // Filter state for My Complaints
  const [complaintFilterStatus, setComplaintFilterStatus] = useState('All');
  const [complaintSearch, setComplaintSearch] = useState('');

  // Claim Complaint Form State
  const [claimComplaintId, setClaimComplaintId] = useState('');
  const [claimTrackingToken, setClaimTrackingToken] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimMessage, setClaimMessage] = useState(null);

  // Profile Edit State
  const [profileName, setProfileName] = useState(citizenUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(citizenUser?.phone || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    fetchCitizenOverview();
    fetchMyComplaints();
  }, [fetchCitizenOverview, fetchMyComplaints]);

  // Handle Claiming Guest Complaint
  const handleClaimComplaint = async (e) => {
    e.preventDefault();
    if (!claimComplaintId.trim() || !claimTrackingToken.trim()) {
      setClaimMessage({
        type: 'error',
        text: 'Both Complaint ID and tracking token are required.',
      });
      return;
    }

    try {
      setClaimLoading(true);
      setClaimMessage(null);
      const res = await claimComplaint(claimComplaintId.trim(), claimTrackingToken.trim());
      setClaimMessage({
        type: 'success',
        text: res.message || 'Complaint successfully linked to your dashboard.',
      });
      setClaimComplaintId('');
      setClaimTrackingToken('');
    } catch (err) {
      setClaimMessage({
        type: 'error',
        text: err.message || 'Could not link complaint. Please check your credentials.',
      });
    } finally {
      setClaimLoading(false);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileLoading(true);
      setProfileMessage(null);
      const res = await updateCitizenProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
      });
      setProfileMessage({
        type: 'success',
        text: 'Profile updated successfully.',
      });
    } catch (err) {
      setProfileMessage({
        type: 'error',
        text: err.message || 'Failed to update profile.',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: 'New password and confirmation do not match.',
      });
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordMessage(null);
      const res = await changeCitizenPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordMessage({
        type: 'success',
        text: 'Password updated successfully.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.message || 'Failed to change password.',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const activeComplaintsList = myComplaints.filter((c) => !['Resolved', 'Rejected'].includes(c.status));
  const resolvedComplaintsList = myComplaints.filter((c) => c.status === 'Resolved');

  // Filtered complaints
  const filteredComplaints = myComplaints.filter((c) => {
    if (complaintFilterStatus === 'Active') {
      if (['Resolved', 'Rejected'].includes(c.status)) return false;
    } else if (complaintFilterStatus !== 'All' && c.status !== complaintFilterStatus) {
      return false;
    }
    if (complaintSearch.trim()) {
      const q = complaintSearch.toLowerCase();
      const matchId = c.complaintId?.toLowerCase().includes(q);
      const matchDesc = c.description?.toLowerCase().includes(q);
      const matchCat = c.category?.toLowerCase().includes(q);
      const matchLoc = c.location?.address?.toLowerCase().includes(q);
      if (!matchId && !matchDesc && !matchCat && !matchLoc) return false;
    }
    return true;
  });

  const stats = citizenOverview?.stats || {
    totalComplaints: myComplaints.length,
    activeComplaints: activeComplaintsList.length,
    resolvedComplaints: resolvedComplaintsList.length,
    followedIssuesCount: followedIssues.length,
    unreadNotificationsCount,
  };

  return (
    <div className="space-y-8 py-4 sm:py-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-[#191B1D] text-white">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs text-[#D2E873]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Personal Citizen Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Welcome, {citizenUser?.name || 'Citizen'}
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A4AB] max-w-xl">
            Track your submitted civic issues, monitor official dispatch timelines, and claim previous guest reports into your dashboard.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="md"
            icon={PlusCircle}
            onClick={() => setIsSubmitModalOpen(true)}
            className="shadow-sm"
          >
            Report New Issue
          </Button>
          <Button
            variant="ghost"
            size="md"
            icon={LogOut}
            onClick={logoutCitizenUser}
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white"
          >
            Log Out
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#E6E5DE]">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'complaints', label: `My Complaints (${myComplaints.length})`, icon: FileText },
          { id: 'claim', label: 'Link Guest Report', icon: LinkIcon },
          { id: 'followed', label: `Followed Issues (${followedIssues.length})`, icon: Bookmark },
          {
            id: 'notifications',
            label: `Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount})` : ''}`,
            icon: Bell,
          },
          { id: 'profile', label: 'Profile & Security', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#191B1D] text-white shadow-xs'
                  : 'text-[#4B4E54] hover:bg-[#F0EFEA] hover:text-[#191B1D]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION A: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-8">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card
              onClick={() => {
                setActiveSection('complaints');
                setComplaintFilterStatus('All');
              }}
              className="p-5 border border-[#E6E5DE] bg-white cursor-pointer hover:border-[#191B1D] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7E828B]">
                Total Reports
              </span>
              <div className="text-3xl font-bold text-[#191B1D] mt-2">
                {stats.totalComplaints}
              </div>
              <span className="text-[11px] text-[#7E828B] mt-1 block">In your personal portfolio</span>
            </Card>

            <Card
              onClick={() => {
                setActiveSection('complaints');
                setComplaintFilterStatus('Active');
              }}
              className="p-5 border border-[#E6E5DE] bg-white cursor-pointer hover:border-[#A36B00] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A36B00]">
                Active Reports
              </span>
              <div className="text-3xl font-bold text-[#A36B00] mt-2">
                {stats.activeComplaints}
              </div>
              <span className="text-[11px] text-[#7E828B] mt-1 block">Triage & field repair</span>
            </Card>

            <Card
              onClick={() => {
                setActiveSection('complaints');
                setComplaintFilterStatus('Resolved');
              }}
              className="p-5 border border-[#E6E5DE] bg-white cursor-pointer hover:border-[#2D7A4D] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2D7A4D]">
                Resolved
              </span>
              <div className="text-3xl font-bold text-[#2D7A4D] mt-2">
                {stats.resolvedComplaints}
              </div>
              <span className="text-[11px] text-[#7E828B] mt-1 block">Completed repairs</span>
            </Card>

            <Card
              onClick={() => setActiveSection('followed')}
              className="p-5 border border-[#E6E5DE] bg-white cursor-pointer hover:border-[#191B1D] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#191B1D]">
                Followed Issues
              </span>
              <div className="text-3xl font-bold text-[#191B1D] mt-2">
                {stats.followedIssuesCount}
              </div>
              <span className="text-[11px] text-[#7E828B] mt-1 block">Neighborhood alerts</span>
            </Card>

            <Card
              onClick={() => setActiveSection('notifications')}
              className="p-5 border border-[#E6E5DE] bg-white col-span-2 lg:col-span-1 cursor-pointer hover:border-[#8CA81F] transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8CA81F]">
                Unread Alerts
              </span>
              <div className="text-3xl font-bold text-[#191B1D] mt-2">
                {unreadNotificationsCount}
              </div>
              <span className="text-[11px] text-[#7E828B] mt-1 block">Status & dispatch updates</span>
            </Card>
          </div>

          {/* Active vs Resolved Reports Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Active Reports */}
            <Card className="p-6 border border-[#E6E5DE] bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-[#191B1D]">Active Reports ({activeComplaintsList.length})</h3>
                  <p className="text-xs text-[#7E828B]">Issues pending triage and field repair</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSection('complaints');
                    setComplaintFilterStatus('Active');
                  }}
                  className="text-xs font-medium text-[#191B1D] hover:underline"
                >
                  View Active ({activeComplaintsList.length})
                </button>
              </div>

              {activeComplaintsList.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <FileText className="w-8 h-8 text-[#A0A4AB] mx-auto" />
                  <p className="text-xs text-[#7E828B]">
                    No active complaints currently in progress.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={PlusCircle}
                    onClick={() => setIsSubmitModalOpen(true)}
                  >
                    Report an Issue
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeComplaintsList.slice(0, 4).map((c) => (
                    <div
                      key={c._id || c.complaintId}
                      className="p-3.5 rounded-xl border border-[#E6E5DE] bg-[#F7F7F4] flex items-center justify-between gap-3 hover:border-[#191B1D] transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#191B1D]">
                            {c.complaintId}
                          </span>
                          <Badge variant={c.status === 'In Progress' ? 'warning' : 'neutral'}>
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#4B4E54] truncate">{c.category}</p>
                        <p className="text-[11px] text-[#7E828B] truncate">{c.location?.address}</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComplaintId(c.complaintId)}
                      >
                        Inspect
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Resolved Reports */}
            <Card className="p-6 border border-[#E6E5DE] bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-[#191B1D]">Resolved Reports ({resolvedComplaintsList.length})</h3>
                  <p className="text-xs text-[#7E828B]">Completed repairs with verified outcome</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSection('complaints');
                    setComplaintFilterStatus('Resolved');
                  }}
                  className="text-xs font-medium text-[#2D7A4D] hover:underline"
                >
                  View Resolved ({resolvedComplaintsList.length})
                </button>
              </div>

              {resolvedComplaintsList.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle className="w-8 h-8 text-[#A0A4AB] mx-auto" />
                  <p className="text-xs text-[#7E828B]">
                    No resolved complaints yet. Completed repairs will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resolvedComplaintsList.slice(0, 4).map((c) => (
                    <div
                      key={c._id || c.complaintId}
                      className="p-3.5 rounded-xl border border-[#E6E5DE] bg-[#F7F7F4] flex items-center justify-between gap-3 hover:border-[#2D7A4D] transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[#191B1D]">
                            {c.complaintId}
                          </span>
                          <Badge variant="success">
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#4B4E54] truncate">{c.category}</p>
                        <p className="text-[11px] text-[#7E828B] truncate">{c.location?.address}</p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComplaintId(c.complaintId)}
                      >
                        Inspect
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Followed Master Issues */}
          <Card className="p-6 border border-[#E6E5DE] bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-[#191B1D]">Followed Neighborhood Issues</h3>
                <p className="text-xs text-[#7E828B]">Civic projects you are actively watching</p>
              </div>
              <button
                onClick={() => setActiveSection('followed')}
                className="text-xs font-medium text-[#191B1D] hover:underline"
              >
                View all ({followedIssues.length})
              </button>
            </div>

            {followedIssues.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <Bookmark className="w-8 h-8 text-[#A0A4AB] mx-auto" />
                <p className="text-xs text-[#7E828B]">
                  You are not following any neighborhood issues yet.
                </p>
                <span className="text-[11px] text-[#7E828B] block">
                  Browse the Public Portal or Map and click "Follow Issue" on any civic concern.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {followedIssues.slice(0, 4).map((m) => (
                  <div
                    key={m.masterIssueId}
                    className="p-3.5 rounded-xl border border-[#E6E5DE] bg-[#F7F7F4] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#191B1D]">
                          {m.masterIssueId}
                        </span>
                        <Badge variant="accent">{m.status}</Badge>
                      </div>
                      <p className="text-xs font-medium text-[#191B1D] truncate">
                        {m.title || m.category}
                      </p>
                      <p className="text-[11px] text-[#7E828B] truncate">
                        {m.location?.address} &bull; {m.supportingReportCount || 1} reports
                      </p>
                    </div>

                    <button
                      onClick={() => toggleFollowIssue(m.masterIssueId)}
                      className="text-xs text-[#7E828B] hover:text-[#9E2B25] transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SECTION B: MY COMPLAINTS */}
      {activeSection === 'complaints' && (
        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#191B1D] tracking-tight">
                My Complaints Portfolio
              </h2>
              <p className="text-xs text-[#7E828B]">
                Complete history of complaints reported under your account or claimed as guest submissions.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={PlusCircle}
              onClick={() => setIsSubmitModalOpen(true)}
            >
              Report New Issue
            </Button>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={complaintSearch}
                onChange={(e) => setComplaintSearch(e.target.value)}
                placeholder="Search by ID, keyword, address..."
                className="w-full px-3.5 py-2 pl-9 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-xs text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
              />
              <Search className="w-4 h-4 text-[#7E828B] absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['All', 'Active', 'Pending', 'In Progress', 'Resolved'].map((st) => (
                <button
                  key={st}
                  onClick={() => setComplaintFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    complaintFilterStatus === st
                      ? 'bg-[#191B1D] text-white'
                      : 'bg-[#F0EFEA] text-[#4B4E54] hover:text-[#191B1D]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Complaints Table/Cards */}
          {myComplaints.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-[#A0A4AB] mx-auto" />
              <h3 className="text-sm font-semibold text-[#191B1D]">No complaints yet.</h3>
              <p className="text-xs text-[#7E828B] max-w-sm mx-auto">
                You have not submitted any complaints under this account.
              </p>
              <Button
                variant="primary"
                size="sm"
                icon={PlusCircle}
                onClick={() => setIsSubmitModalOpen(true)}
              >
                Report Your First Issue
              </Button>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FileText className="w-10 h-10 text-[#A0A4AB] mx-auto" />
              <h3 className="text-sm font-semibold text-[#191B1D]">No complaints found</h3>
              <p className="text-xs text-[#7E828B] max-w-sm mx-auto">
                No complaints match the current filter or search criteria.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6E5DE] border border-[#E6E5DE] rounded-2xl overflow-hidden">
              {filteredComplaints.map((c) => (
                <div
                  key={c._id || c.complaintId}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F5] transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[#191B1D]">
                        {c.complaintId}
                      </span>
                      <Badge variant={c.status === 'Resolved' ? 'success' : c.status === 'In Progress' ? 'warning' : 'neutral'}>
                        {c.status}
                      </Badge>
                      {c.severity && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F0EFEA] text-[#4B4E54] font-medium">
                          Severity: {c.severity}
                        </span>
                      )}
                      <span className="text-[11px] text-[#7E828B]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-medium text-[#191B1D]">{c.category}</h4>
                    <p className="text-xs text-[#4B4E54] line-clamp-2">{c.description}</p>
                    <p className="text-[11px] text-[#7E828B] flex items-center gap-1">
                      <span>{c.location?.address}</span>
                      {c.department && <span>&bull; Assigned: {c.department}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={ExternalLink}
                      onClick={() => setSelectedComplaintId(c.complaintId)}
                    >
                      Track & Inspect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SECTION C: LINK GUEST REPORT (Claim Complaint) */}
      {activeSection === 'claim' && (
        <Card className="max-w-xl mx-auto p-8 border border-[#E6E5DE] bg-white space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EFEA] flex items-center justify-center mx-auto text-[#191B1D] mb-3">
              <LinkIcon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-[#191B1D] tracking-tight">
              Link a Guest Complaint
            </h2>
            <p className="text-xs text-[#7E828B] leading-relaxed">
              Did you submit a complaint before creating an account? Enter your unique Complaint ID and the secret tracking token provided on your submission screen to claim it into your personal dashboard.
            </p>
          </div>

          {claimMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed ${
                claimMessage.type === 'error'
                  ? 'bg-[#FBEAE9] border border-[#F1B5B2] text-[#9E2B25]'
                  : 'bg-[#F2F8D5] border border-[#D2E873] text-[#3E520A]'
              }`}
            >
              {claimMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>{claimMessage.text}</div>
            </div>
          )}

          <form onSubmit={handleClaimComplaint} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
                Complaint ID
              </label>
              <input
                type="text"
                value={claimComplaintId}
                onChange={(e) => setClaimComplaintId(e.target.value)}
                placeholder="e.g. CP-20261031-ABCD"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm font-mono text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
                Secret Tracking Token
              </label>
              <input
                type="text"
                value={claimTrackingToken}
                onChange={(e) => setClaimTrackingToken(e.target.value)}
                placeholder="Enter 48-character tracking token"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm font-mono text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                required
              />
              <span className="text-[11px] text-[#7E828B] mt-1 block">
                Found on your submission confirmation card or tracking bookmark.
              </span>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center shadow-xs"
                loading={claimLoading}
              >
                Claim & Link to Dashboard
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* SECTION D: FOLLOWED ISSUES */}
      {activeSection === 'followed' && (
        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-[#191B1D] tracking-tight">
              Followed Neighborhood Issues
            </h2>
            <p className="text-xs text-[#7E828B]">
              You will receive automatic alerts whenever the municipal dispatch team updates status or uploads field resolution evidence for these issues.
            </p>
          </div>

          {followedIssues.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Bookmark className="w-10 h-10 text-[#A0A4AB] mx-auto" />
              <h3 className="text-sm font-semibold text-[#191B1D]">No followed issues</h3>
              <p className="text-xs text-[#7E828B] max-w-sm mx-auto">
                Explore the Public Map or Citizen Portal to find neighborhood master issues to follow.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followedIssues.map((m) => (
                <div
                  key={m.masterIssueId}
                  className="p-5 rounded-2xl border border-[#E6E5DE] bg-[#FAF9F5] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#191B1D]">
                        {m.masterIssueId}
                      </span>
                      <Badge variant={m.status === 'Resolved' ? 'success' : 'accent'}>
                        {m.status}
                      </Badge>
                    </div>

                    <h4 className="font-semibold text-sm text-[#191B1D]">
                      {m.title || m.category}
                    </h4>
                    <p className="text-xs text-[#4B4E54] line-clamp-2">
                      {m.description || m.location?.address}
                    </p>

                    <div className="text-[11px] text-[#7E828B] space-y-0.5 pt-1">
                      <div>Location: {m.location?.address}</div>
                      <div>Supporting Reports: {m.supportingReportCount || 1} &bull; Endorsements: {m.citizenSupportCount || 0}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E6E5DE]">
                    <span className="text-[11px] text-[#2D7A4D] font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Notifications Active</span>
                    </span>
                    <button
                      onClick={() => toggleFollowIssue(m.masterIssueId)}
                      className="text-xs font-medium text-[#9E2B25] hover:underline"
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SECTION E: NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#191B1D] tracking-tight">
                Activity Notifications
              </h2>
              <p className="text-xs text-[#7E828B]">
                Real-time alerts for your submitted complaints, status transitions, and followed issues.
              </p>
            </div>

            {citizenNotifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllNotificationsRead}
              >
                Mark all as read
              </Button>
            )}
          </div>

          {citizenNotifications.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Bell className="w-10 h-10 text-[#A0A4AB] mx-auto" />
              <h3 className="text-sm font-semibold text-[#191B1D]">No notifications</h3>
              <p className="text-xs text-[#7E828B]">
                You have no activity alerts right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6E5DE] border border-[#E6E5DE] rounded-2xl overflow-hidden">
              {citizenNotifications.map((n) => (
                <div
                  key={n._id}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                    !n.isRead ? 'bg-[#F2F8D5]/30' : 'hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[#191B1D]">
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#8CA81F]" />
                      )}
                      <span className="text-[10px] text-[#7E828B]">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#4B4E54] leading-relaxed">{n.message}</p>
                    {n.complaintId && (
                      <button
                        onClick={() => setSelectedComplaintId(n.complaintId)}
                        className="text-xs font-medium text-[#191B1D] hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <span>View Complaint #{n.complaintId}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={() => markNotificationRead(n._id)}
                      className="text-xs text-[#7E828B] hover:text-[#191B1D] whitespace-nowrap"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SECTION F: PROFILE & SECURITY */}
      {activeSection === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Details */}
          <Card className="p-6 border border-[#E6E5DE] bg-white space-y-5">
            <div>
              <h3 className="font-semibold text-base text-[#191B1D]">Account Details</h3>
              <p className="text-xs text-[#7E828B]">Manage your citizen personal details</p>
            </div>

            {profileMessage && (
              <div
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  profileMessage.type === 'error'
                    ? 'bg-[#FBEAE9] border border-[#F1B5B2] text-[#9E2B25]'
                    : 'bg-[#F2F8D5] border border-[#D2E873] text-[#3E520A]'
                }`}
              >
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Email Address (Primary Identity)
                </label>
                <input
                  type="email"
                  value={citizenUser?.email || ''}
                  disabled
                  className="w-full px-3 py-2 rounded-xl bg-[#EBE9E1] border border-[#E6E5DE] text-sm text-[#7E828B] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={profileLoading}
              >
                Save Details
              </Button>
            </form>
          </Card>

          {/* Change Password */}
          <Card className="p-6 border border-[#E6E5DE] bg-white space-y-5">
            <div>
              <h3 className="font-semibold text-base text-[#191B1D]">Change Password</h3>
              <p className="text-xs text-[#7E828B]">Secure your citizen dashboard credentials</p>
            </div>

            {passwordMessage && (
              <div
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  passwordMessage.type === 'error'
                    ? 'bg-[#FBEAE9] border border-[#F1B5B2] text-[#9E2B25]'
                    : 'bg-[#F2F8D5] border border-[#D2E873] text-[#3E520A]'
                }`}
              >
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#7E828B] hover:text-[#191B1D]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  New Password (at least 6 characters)
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                size="md"
                loading={passwordLoading}
              >
                Update Password
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
