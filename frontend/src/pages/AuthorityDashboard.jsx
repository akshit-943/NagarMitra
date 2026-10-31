import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import CivicMap from '../components/CivicMap';
import MasterIssueModal from '../components/MasterIssueModal';
import { useCivic } from '../context/CivicContext';
import { getComplaintStats, getAuthorityAnalytics, getCivicTrends } from '../services/complaintService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import {
  Check,
  RefreshCw,
  ExternalLink,
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Flame,
  TrendingUp,
  AlertTriangle,
  ThumbsUp,
  GitMerge,
  Filter,
  UserCheck,
  Timer,
  Clock,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function AuthorityDashboard() {
  const {
    complaints,
    masterIssues,
    hotspots,
    hotspotsMeta,
    prioritySummary,
    loading,
    updateStatus,
    setSelectedComplaintId,
    selectedMasterIssueId,
    setSelectedMasterIssueId,
    navigateToMasterIssue,
    fetchLiveComplaints,
    fetchLiveMasterIssues,
    fetchHotspots,
    fetchPrioritySummaryData,
    resolveDuplicateAction,
  } = useCivic();

  const [tableMode, setTableMode] = useState('master'); // 'master' or 'individual'
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statsData, setStatsData] = useState(null);
  const [authorityAnalytics, setAuthorityAnalytics] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [quickMergeData, setQuickMergeData] = useState(null);
  const [isQuickMerging, setIsQuickMerging] = useState(false);

  const fetchStatsAndAnalytics = async () => {
    try {
      const [statsRes, analyticsRes, trendsRes] = await Promise.all([
        getComplaintStats().catch(() => ({ success: false })),
        getAuthorityAnalytics().catch(() => ({ success: false })),
        getCivicTrends().catch(() => ({ success: false })),
      ]);
      if (statsRes.success) {
        setStatsData(statsRes.data);
      }
      if (analyticsRes.success) {
        setAuthorityAnalytics(analyticsRes.data);
      }
      if (trendsRes.success && trendsRes.data) {
        setTrendsData(trendsRes.data);
      }
    } catch (err) {
      console.warn('Could not load authority metrics:', err.message);
    }
  };

  useEffect(() => {
    fetchStatsAndAnalytics();
  }, [complaints, masterIssues]);

  const handleRefreshAll = () => {
    fetchLiveComplaints();
    fetchLiveMasterIssues();
    fetchHotspots();
    fetchPrioritySummaryData();
    fetchStatsAndAnalytics();
  };

  const handleStatusUpdate = async (complaintId, nextStatus) => {
    try {
      setActionLoadingId(complaintId);
      await updateStatus(
        complaintId,
        nextStatus,
        `Operational status updated by Municipal Command Console`,
        'Municipal Authority'
      );
      await fetchStats();
      fetchLiveMasterIssues();
    } catch (err) {
      alert(`Status transition error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  // Filter master issues
  const filteredMasterIssues = masterIssues.filter((m) => {
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || m.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || m.priority?.level === priorityFilter;
    return matchesStatus && matchesCategory && matchesPriority;
  });

  // Calculate potential duplicates awaiting review across master issues
  const totalPendingDuplicates = masterIssues.reduce((acc, m) => {
    const pending = m.potentialDuplicates?.filter((p) => p.status === 'Pending') || [];
    return acc + pending.length;
  }, 0);

  const criticalIssuesCount = masterIssues.filter((m) => m.priority?.level === 'Critical').length;

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

  // Build live category distribution chart data
  const liveCategoryData = statsData?.byCategory
    ? Object.entries(statsData.byCategory).map(([name, count]) => ({
        name,
        count,
      }))
    : [];

  return (
    <div className="space-y-8 py-2">
      {/* 1. TOP HEADER & SYSTEM METRICS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E6E5DE]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#191B1D]" />
            <h1 className="font-editorial text-3xl text-[#191B1D]">
              Municipal Operations Command
            </h1>
          </div>
          <p className="text-xs text-[#7E828B] mt-0.5">
            AI Triage Engine • Dynamic Civic Priority • Geospatial Hotspots &amp; Duplicate Management
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="lime" size="md" dot>
            Atlas &amp; Intelligence Synced
          </Badge>
          <button
            onClick={handleRefreshAll}
            className="p-1 rounded-full text-[#7E828B] hover:text-[#191B1D]"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. PHASE 5 OPERATIONAL SLA & DISPATCH KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE]">
          <span className="text-[11px] font-medium text-[#7E828B] block flex items-center justify-between">
            <span>Unresolved</span>
            <Layers className="w-3.5 h-3.5 text-[#55478A]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#191B1D]">
              {authorityAnalytics?.unresolved ?? masterIssues.filter(m => m.status !== 'Resolved' && m.status !== 'Rejected').length}
            </span>
            <span className="text-[10px] text-[#7E828B]">active</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFF9E6] border border-[#F5E296]">
          <span className="text-[11px] font-semibold text-[#865917] block flex items-center justify-between">
            <span>Awaiting Assign</span>
            <UserCheck className="w-3.5 h-3.5 text-[#865917]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#865917]">
              {authorityAnalytics?.awaitingAssignment ?? masterIssues.filter(m => !m.assignedOfficer?.id && m.status === 'Pending').length}
            </span>
            <span className="text-[10px] text-[#865917]">pending</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F0F5FD] border border-[#D5E3FB]">
          <span className="text-[11px] font-semibold text-[#2D5DA1] block flex items-center justify-between">
            <span>In Progress</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#2D5DA1]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#2D5DA1]">
              {authorityAnalytics?.inProgress ?? masterIssues.filter(m => m.status === 'In Progress').length}
            </span>
            <span className="text-[10px] text-[#2D5DA1]">in field</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FBE8E8] border border-[#F5C2BE]">
          <span className="text-[11px] font-semibold text-[#9E2A2B] block flex items-center justify-between">
            <span>Overdue SLA</span>
            <Timer className="w-3.5 h-3.5 text-[#9E2A2B]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#9E2A2B]">
              {authorityAnalytics?.overdue ?? 0}
            </span>
            <span className="text-[10px] text-[#9E2A2B]">breached</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F3F8D8] border border-[#D2E873]">
          <span className="text-[11px] font-semibold text-[#3E520A] block flex items-center justify-between">
            <span>SLA Compliance</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#3E520A]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#3E520A]">
              {authorityAnalytics?.slaComplianceRate != null ? `${authorityAnalytics.slaComplianceRate}%` : 'N/A'}
            </span>
            <span className="text-[10px] text-[#3E520A]">on-time</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E6E5DE]">
          <span className="text-[11px] font-medium text-[#7E828B] block flex items-center justify-between">
            <span>Avg Resolution</span>
            <Clock className="w-3.5 h-3.5 text-[#191B1D]" />
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#191B1D]">
              {authorityAnalytics?.avgResolutionHours != null ? `${authorityAnalytics.avgResolutionHours}h` : 'N/A'}
            </span>
            <span className="text-[10px] text-[#7E828B]">cycle</span>
          </div>
        </div>
      </div>

      {/* 3. PHASE 4 INTELLIGENCE KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-[#E6E5DE]">
          <span className="text-[11px] font-medium text-[#7E828B] block flex items-center justify-between">
            <span>Master Issues</span>
            <Layers className="w-3.5 h-3.5 text-[#55478A]" />
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#191B1D]">
              {masterIssues.length}
            </span>
            <span className="text-[10px] text-[#7E828B]">
              across {complaints.length} reports
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FBE8E8] border border-[#F5C2BE]">
          <span className="text-[11px] font-semibold text-[#9E2A2B] block flex items-center justify-between">
            <span>Critical Priority</span>
            <Flame className="w-3.5 h-3.5 text-[#9E2A2B]" />
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#9E2A2B]">
              {criticalIssuesCount}
            </span>
            <span className="text-[10px] text-[#9E2A2B] font-medium">Urgent intervention</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FFF9E6] border border-[#F5E296]">
          <span className="text-[11px] font-semibold text-[#865917] block flex items-center justify-between">
            <span>Potential Duplicates</span>
            <GitMerge className="w-3.5 h-3.5 text-[#865917]" />
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#865917]">
              {totalPendingDuplicates}
            </span>
            <span className="text-[10px] text-[#865917]">Pending review</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F3F8D8] border border-[#D2E873]">
          <span className="text-[11px] font-semibold text-[#3E520A] block flex items-center justify-between">
            <span>Active Hotspots</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#3E520A]" />
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-editorial text-2xl font-bold text-[#191B1D]">
              {hotspots.length}
            </span>
            <span className="text-[10px] text-[#3E520A]">Spatial clusters</span>
          </div>
        </div>
      </div>

      {/* 3. RECHARTS ANALYTICS GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Historical Velocity */}
        <Card variant="white" padding="default" className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[#191B1D]">Incident Intake vs. Resolution Velocity</h3>
              <p className="text-xs text-[#7E828B]">Aggregated trend line</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {trendsData?.volumeOverTime && trendsData.volumeOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsData.volumeOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIntake" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#191B1D" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#191B1D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D2E873" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#D2E873" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E5DE" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7E828B' }} axisLine={false} tickLine={false} tickFormatter={(val) => typeof val === 'string' && val.length >= 10 ? val.slice(5) : val} />
                  <YAxis tick={{ fontSize: 11, fill: '#7E828B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E6E5DE',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Area type="monotone" dataKey="received" stroke="#191B1D" strokeWidth={2} fillOpacity={1} fill="url(#colorIntake)" name="Received" />
                  <Area type="monotone" dataKey="resolved" stroke="#8CA81F" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" name="Resolved" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-[#7E828B] space-y-1">
                <TrendingUp className="w-6 h-6 text-[#A0A4AB]" />
                <p className="font-medium text-[#191B1D]">No trend data available yet</p>
                <p className="text-[11px] text-[#7E828B]">Trajectory curves will populate automatically as complaints are submitted.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Live Category Distribution Bar Chart */}
        <Card variant="white" padding="default" className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[#191B1D]">Live Category Breakdown</h3>
              <p className="text-xs text-[#7E828B]">Real-time database volume</p>
            </div>
            <Badge variant="neutral" size="sm">
              Live API
            </Badge>
          </div>

          <div className="h-64 w-full">
            {liveCategoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#7E828B]">
                Submit complaints to populate category metrics.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={liveCategoryData}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E6E5DE" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#7E828B' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#191B1D' }}
                    axisLine={false}
                    tickLine={false}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E6E5DE',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" fill="#3E7295" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* 4. DEPARTMENT WORKLOAD & SLA COMPLIANCE SUMMARY */}
      {authorityAnalytics?.departmentBreakdown && authorityAnalytics.departmentBreakdown.length > 0 && (
        <Card variant="white" padding="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E5DE] pb-3">
            <div>
              <h3 className="font-semibold text-sm text-[#191B1D] flex items-center gap-1.5">
                <Building className="w-4 h-4 text-[#3E7295]" />
                Municipal Department Workload &amp; SLA Compliance
              </h3>
              <p className="text-xs text-[#7E828B]">
                Real-time operational dispatch balance across responsible municipal units
              </p>
            </div>
            <Badge variant="lime" size="sm" dot>
              Live Operations
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {authorityAnalytics.departmentBreakdown.map((dept) => (
              <div
                key={dept.department}
                className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#191B1D] truncate">{dept.department}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      dept.complianceRate >= 90
                        ? 'bg-[#F3F8D8] text-[#3E520A] border-[#D2E873]'
                        : dept.complianceRate >= 70
                        ? 'bg-[#FFF9E6] text-[#865917] border-[#F5E296]'
                        : 'bg-[#FBE8E8] text-[#9E2A2B] border-[#F5C2BE]'
                    }`}
                  >
                    {dept.complianceRate}% SLA
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  <div className="bg-white p-1.5 rounded border border-[#E6E5DE] text-center">
                    <span className="text-[10px] text-[#7E828B] block">Total</span>
                    <span className="font-bold text-[#191B1D]">{dept.total}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-[#E6E5DE] text-center">
                    <span className="text-[10px] text-[#2D5DA1] block">In Progress</span>
                    <span className="font-bold text-[#2D5DA1]">{dept.inProgress}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-[#E6E5DE] text-center">
                    <span className="text-[10px] text-[#9E2A2B] block">Overdue</span>
                    <span className="font-bold text-[#9E2A2B]">{dept.overdue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. GEOSPATIAL MAP VIEW & CIVIC HOTSPOTS ANALYSIS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-editorial text-2xl text-[#191B1D]">
              Geospatial Field Heatmap &amp; Civic Hotspots
            </h3>
            <p className="text-xs text-[#7E828B]">
              Shaded concentric radii indicate identified spatial clusters with recurring complaints
            </p>
          </div>
          <span className="text-xs text-[#7E828B]">
            {hotspots.length} active hotspot zones detected
          </span>
        </div>

        <CivicMap
          mode="authority"
          issues={filteredComplaints.map((c) => ({
            ...c,
            id: c.complaintId,
            title: c.category,
            location: c.location?.address || 'City zone',
            coordinates: c.location?.latitude && c.location?.longitude
              ? [Number(c.location.latitude), Number(c.location.longitude)]
              : null,
            supportingReportCount: c.isMasterIssuePrimary ? 2 : 1,
          }))}
          hotspots={hotspots}
          showHotspots={true}
          height="400px"
          onSelectIssue={(issue) => setSelectedComplaintId(issue.complaintId || issue.id)}
        />

        {/* Hotspots Summary Cards Row */}
        {hotspots.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {hotspots.slice(0, 3).map((hs) => (
              <div
                key={hs.hotspotId}
                className="p-3.5 rounded-xl bg-white border border-[#E6E5DE] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#191B1D] truncate">{hs.zone}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.2 rounded font-semibold ${
                      hs.intensity === 'High'
                        ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                        : 'bg-[#F3F8D8] text-[#3E520A]'
                    }`}
                  >
                    {hs.intensity} Intensity
                  </span>
                </div>
                <div className="text-xs text-[#4B4E54] flex items-center justify-between">
                  <span>{hs.category}</span>
                  <span className="font-bold text-[#191B1D]">{hs.complaintCount} reports</span>
                </div>
                <div className="text-[10px] text-[#7E828B] pt-1 border-t border-[#E6E5DE] flex items-center justify-between">
                  <span>Trend: <strong className="text-[#191B1D]">{hs.trend}</strong></span>
                  <span>{hs.timePeriod}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. INCIDENTS DISPATCH & TRIAGE TABLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-editorial text-2xl text-[#191B1D]">
                {tableMode === 'master' ? 'Consolidated Master Issues' : 'Individual Incident Queue'}
              </h3>
              <div className="flex items-center bg-[#F0EFEA] border border-[#E6E5DE] rounded-full p-0.5 text-xs">
                <button
                  onClick={() => setTableMode('master')}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    tableMode === 'master' ? 'bg-[#191B1D] text-white shadow-sm' : 'text-[#7E828B] hover:text-[#191B1D]'
                  }`}
                >
                  Master Issues ({masterIssues.length})
                </button>
                <button
                  onClick={() => setTableMode('individual')}
                  className={`px-3 py-1 rounded-full font-medium transition-all ${
                    tableMode === 'individual' ? 'bg-[#191B1D] text-white shadow-sm' : 'text-[#7E828B] hover:text-[#191B1D]'
                  }`}
                >
                  Individual Reports ({complaints.length})
                </button>
              </div>
            </div>
            <p className="text-xs text-[#7E828B] mt-0.5">
              {tableMode === 'master'
                ? 'De-duplicated civic problems ordered by dynamic multi-factor priority score'
                : 'Direct citizen submission registry and raw audit trail'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tableMode === 'master' && (
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs bg-white border border-[#E6E5DE] rounded-full px-3 py-1.5 text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-[#E6E5DE] rounded-full px-3 py-1.5 text-[#191B1D] focus:outline-none focus:border-[#191B1D]"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white border border-[#E6E5DE] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            {tableMode === 'master' ? (
              /* MASTER ISSUES TABLE */
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F4] border-b border-[#E6E5DE] text-[#7E828B] uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Master Issue ID</th>
                    <th className="py-3 px-4">Category &amp; Problem</th>
                    <th className="py-3 px-4">Dynamic Civic Priority</th>
                    <th className="py-3 px-4">Assigned Unit &amp; Officer</th>
                    <th className="py-3 px-4">SLA Target &amp; Status</th>
                    <th className="py-3 px-4">Impact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E5DE] text-[#191B1D]">
                  {filteredMasterIssues.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[#7E828B]">
                        No master issues matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMasterIssues.map((issue) => {
                      const priority = issue.priority;
                      const pendingDup = issue.potentialDuplicates?.find((p) => p.status === 'Pending');
                      const hasPotential = Boolean(pendingDup);
                      const matchConfidence = pendingDup ? Math.round((pendingDup.confidence || 0) * 100) : null;

                      return (
                        <tr key={issue.masterIssueId} className="hover:bg-[#F9F9F6] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#191B1D]">
                            <button
                              onClick={() => navigateToMasterIssue(issue.masterIssueId)}
                              className="hover:underline flex items-center gap-1.5 text-[#191B1D]"
                            >
                              <Layers className="w-3.5 h-3.5 text-[#55478A]" />
                              <span>{issue.masterIssueId}</span>
                            </button>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-[#191B1D] truncate flex items-center gap-1.5 flex-wrap">
                              <span>{issue.category}</span>
                              {hasPotential && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-[#FFF3D6] text-[#865917] border border-[#E8C868] px-2 py-0.5 rounded-full font-semibold shadow-xs">
                                  <AlertTriangle className="w-2.5 h-2.5 text-[#B87000]" />
                                  Duplicate Flag ({matchConfidence}% Match)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#7E828B] truncate">
                              {issue.title}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {priority ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                                    priority.level === 'Critical'
                                      ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                                      : priority.level === 'High'
                                      ? 'bg-[#FBF1D8] text-[#865917]'
                                      : 'bg-[#F3F8D8] text-[#3E520A]'
                                  }`}
                                >
                                  {priority.level} ({priority.score})
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#7E828B]">Uncalculated</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[170px]">
                            <div className="text-[#191B1D] font-medium truncate flex items-center gap-1">
                              <Building className="w-3 h-3 text-[#3E7295] flex-shrink-0" />
                              <span className="truncate">{issue.assignedDepartment || issue.department || 'Municipal Works'}</span>
                            </div>
                            {issue.assignedOfficer?.name ? (
                              <div className="text-[10px] text-[#3E520A] flex items-center gap-1 mt-0.5 font-medium truncate">
                                <UserCheck className="w-3 h-3 text-[#5A7314] flex-shrink-0" />
                                <span className="truncate">{issue.assignedOfficer.name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#865917] bg-[#FFF9E6] px-1.5 py-0.2 rounded font-sans inline-block mt-0.5">
                                Awaiting Dispatch
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {issue.sla?.hasDeadline ? (
                              <div className="space-y-0.5">
                                <Badge variant={issue.sla.badgeVariant} size="sm">
                                  {issue.sla.statusLabel}
                                </Badge>
                                <div className="text-[10px] text-[#7E828B] flex items-center gap-1 font-mono">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{new Date(issue.sla.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ) : issue.resolutionDeadline ? (
                              <div className="text-[11px] text-[#191B1D] font-mono">
                                {new Date(issue.resolutionDeadline).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#7E828B]">Standard Target</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[11px] text-[#191B1D] font-medium">
                              {issue.supportingReportCount} report(s)
                            </div>
                            <div className="text-[10px] text-[#7E828B] flex items-center gap-1">
                              <ThumbsUp className="w-2.5 h-2.5 text-[#3E520A]" />
                              {issue.citizenSupportCount} citizen(s) endorsed
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadgeVariant(issue.status)} size="sm" dot>
                              {issue.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {hasPotential && pendingDup && (
                                <button
                                  onClick={() => setQuickMergeData({ masterIssue: issue, duplicate: pendingDup })}
                                  className="px-2.5 py-1 rounded-full bg-[#FAF0DE] hover:bg-[#F5E296] text-[#865917] border border-[#EEDBBA] text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                  title={`Review AI match score (${matchConfidence}%) and merge duplicate`}
                                >
                                  <GitMerge className="w-3 h-3 text-[#B87000]" />
                                  <span>Merge ({matchConfidence}%)</span>
                                </button>
                              )}
                              <button
                                onClick={() => navigateToMasterIssue(issue.masterIssueId)}
                                className="px-3 py-1 rounded-full bg-[#191B1D] text-white hover:bg-[#333] text-[11px] font-medium transition-colors cursor-pointer"
                              >
                                Inspect Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* INDIVIDUAL COMPLAINTS TABLE */
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7F4] border-b border-[#E6E5DE] text-[#7E828B] uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Complaint ID</th>
                    <th className="py-3 px-4">Category &amp; Issue</th>
                    <th className="py-3 px-4">AI Triage / Severity</th>
                    <th className="py-3 px-4">Master Issue Link</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Dispatch Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E5DE] text-[#191B1D]">
                  {filteredComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#7E828B]">
                        No complaints matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredComplaints.map((complaint) => {
                      const isBusy = actionLoadingId === complaint.complaintId;
                      const aiCompleted = complaint.aiAnalysis?.analysisStatus === 'Completed';
                      const aiScore = complaint.aiAnalysis?.severityScore;
                      const severity = complaint.severity || complaint.aiAnalysis?.severityLevel || 'Pending';

                      return (
                        <tr key={complaint.complaintId} className="hover:bg-[#F9F9F6] transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-[#191B1D]">
                            <button
                              onClick={() => setSelectedComplaintId(complaint.complaintId)}
                              className="hover:underline flex items-center gap-1 text-[#191B1D]"
                            >
                              <span>{complaint.complaintId}</span>
                              <ExternalLink className="w-3 h-3 text-[#7E828B]" />
                            </button>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-[#191B1D] truncate flex items-center gap-1.5">
                              <span>{complaint.category}</span>
                              {complaint.aiAnalysis?.requiresHumanReview && (
                                <span className="text-[10px] bg-[#ECE8F9] text-[#55478A] px-1.5 py-0.2 rounded font-sans font-medium">
                                  Review Flag
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#7E828B] truncate">
                              {complaint.aiAnalysis?.detectedIssue || complaint.description}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {aiCompleted ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                                    severity === 'Critical'
                                      ? 'bg-[#FBE8E8] text-[#9E2A2B]'
                                      : severity === 'High'
                                      ? 'bg-[#FBF1D8] text-[#865917]'
                                      : severity === 'Medium'
                                      ? 'bg-[#F3F8D8] text-[#3E520A]'
                                      : 'bg-[#F0EFEA] text-[#4B4E54]'
                                  }`}
                                >
                                  {severity} ({aiScore})
                                </span>
                              </div>
                            ) : complaint.aiAnalysis?.analysisStatus === 'Processing' ? (
                              <span className="text-[11px] text-[#55478A] animate-pulse flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Analyzing...
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#7E828B]">
                                {severity !== 'Pending' ? severity : 'Unassessed'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {complaint.masterIssueId ? (
                              <button
                                onClick={() => navigateToMasterIssue(complaint.masterIssueId)}
                                className="font-mono text-[11px] text-[#55478A] bg-[#ECE8F9] px-2 py-0.5 rounded hover:underline inline-flex items-center gap-1"
                              >
                                <Layers className="w-3 h-3" />
                                <span>{complaint.masterIssueId}</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#7E828B]">Unlinked</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#4B4E54]">{complaint.location?.address}</td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusBadgeVariant(complaint.status)} size="sm" dot>
                              {complaint.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedComplaintId(complaint.complaintId)}
                                className="px-3 py-1 rounded-full bg-[#191B1D] text-white hover:bg-[#333] text-[11px] font-medium transition-colors"
                              >
                                Inspect Details
                              </button>

                              {complaint.status === 'Pending' && (
                                <button
                                  onClick={() => handleStatusUpdate(complaint.complaintId, 'Under Review')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1 rounded-full bg-[#ECE8F9] hover:bg-[#DDD7F4] text-[11px] font-medium text-[#55478A] transition-colors disabled:opacity-50"
                                >
                                  Review
                                </button>
                              )}

                              {(complaint.status === 'Pending' || complaint.status === 'Under Review') && (
                                <button
                                  onClick={() => handleStatusUpdate(complaint.complaintId, 'In Progress')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1 rounded-full bg-[#F3F8D8] hover:bg-[#E5F1AE] text-[11px] font-semibold text-[#3E520A] transition-colors disabled:opacity-50"
                                >
                                  Dispatch
                                </button>
                              )}

                              {complaint.status === 'In Progress' && (
                                <button
                                  onClick={() => handleStatusUpdate(complaint.complaintId, 'Resolved')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1 rounded-full bg-[#E3ECE1] hover:bg-[#D2E0CF] text-[11px] font-semibold text-[#365734] transition-colors disabled:opacity-50"
                                >
                                  Resolve
                                </button>
                              )}

                              {complaint.status === 'Resolved' && (
                                <span className="text-[11px] text-[#4E704C] font-medium inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Closed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 6. MODAL INSPECTORS */}
      <MasterIssueModal
        masterIssueId={selectedMasterIssueId}
        isOpen={Boolean(selectedMasterIssueId)}
        onClose={() => setSelectedMasterIssueId(null)}
      />

      {/* Quick Merge Confirmation Modal */}
      {quickMergeData && (
        <Modal
          isOpen={Boolean(quickMergeData)}
          onClose={() => setQuickMergeData(null)}
          title="Consolidate Duplicate Incident"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#FFF9E6] border border-[#F5E296] flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF0DE] border border-[#EEDBBA] text-[#865917] flex items-center justify-center shrink-0 mt-0.5">
                <GitMerge className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs text-[#865917]">
                <span className="font-bold block text-sm">
                  AI Duplicate Detection ({Math.round((quickMergeData.duplicate.confidence || 0) * 100)}% Match Confidence)
                </span>
                <p className="leading-relaxed">
                  {quickMergeData.duplicate.matchReason || 'Geographic proximity and category correlation detected between incidents.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#7E828B]">Target Master Issue</span>
                <p className="font-mono font-bold text-[#191B1D]">{quickMergeData.masterIssue.masterIssueId}</p>
                <p className="text-[11px] text-[#7E828B] truncate">{quickMergeData.masterIssue.title}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#F9F9F6] border border-[#E6E5DE] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#7E828B]">Incoming Flagged Report</span>
                <p className="font-mono font-bold text-[#191B1D]">#{quickMergeData.duplicate.complaintId}</p>
                <p className="text-[11px] text-[#7E828B] truncate">Flagged for municipal verification</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F0EFEA] text-xs text-[#191B1D] space-y-1">
              <span className="font-semibold block">Consolidation Impact:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#4B4E54]">
                <li>Merges report into Master Issue #{quickMergeData.masterIssue.masterIssueId}.</li>
                <li>Increases supporting report count and recalculates dynamic priority score.</li>
                <li>Removes redundant solitary tracking items to prevent duplicate field dispatch.</li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E6E5DE]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedComplaintId(quickMergeData.duplicate.complaintId);
                }}
              >
                Inspect Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isQuickMerging}
                onClick={async () => {
                  try {
                    setIsQuickMerging(true);
                    await resolveDuplicateAction(
                      quickMergeData.masterIssue.masterIssueId,
                      quickMergeData.duplicate.complaintId,
                      'Dismiss'
                    );
                    setQuickMergeData(null);
                  } catch (err) {
                    alert(`Error dismissing: ${err.message}`);
                  } finally {
                    setIsQuickMerging(false);
                  }
                }}
              >
                Dismiss as Separate
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isQuickMerging}
                icon={GitMerge}
                onClick={async () => {
                  try {
                    setIsQuickMerging(true);
                    await resolveDuplicateAction(
                      quickMergeData.masterIssue.masterIssueId,
                      quickMergeData.duplicate.complaintId,
                      'Confirm'
                    );
                    setQuickMergeData(null);
                    fetchLiveMasterIssues();
                    fetchLiveComplaints();
                  } catch (err) {
                    alert(`Error merging duplicate: ${err.message}`);
                  } finally {
                    setIsQuickMerging(false);
                  }
                }}
              >
                {isQuickMerging ? 'Merging...' : 'Confirm & Merge into Master Issue'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
