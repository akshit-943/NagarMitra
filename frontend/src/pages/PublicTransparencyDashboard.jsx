import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useCivic } from '../context/CivicContext';
import {
  getTransparencyOverview,
  getCivicTrends,
  getDepartmentPerformance,
  getCivicImpactRecommendations,
  getPublicMasterIssues,
  getPublicIssueTimeline,
  downloadImpactReportPdf,
} from '../services/complaintService';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  MapPin,
  Calendar,
  Layers,
  Search,
  Filter,
  CheckCircle,
  HelpCircle,
  BarChart3,
  Flame,
  Shield,
  ArrowRight,
  ExternalLink,
  Info,
  SlidersHorizontal,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function PublicTransparencyDashboard() {
  const { isAuthorityAuthenticated, setActiveTab: setGlobalTab } = useCivic();
  // Filter state
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('All');
  const [department, setDepartment] = useState('All');
  const [zone, setZone] = useState('All');
  const [isCustomRange, setIsCustomRange] = useState(false);

  // Active sub-view tab
  const [activeTab, setActiveTab] = useState('trends'); // 'trends' | 'departments' | 'recommendations' | 'issues'

  // Data state
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [issuesData, setIssuesData] = useState({ issues: [], total: 0, page: 1, pages: 1 });

  // Explorer filters & timeline modal
  const [issuesSearch, setIssuesSearch] = useState('');
  const [issuesStatusFilter, setIssuesStatusFilter] = useState('All');
  const [selectedTimelineIssue, setSelectedTimelineIssue] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Before/After comparison modal
  const [comparisonIssue, setComparisonIssue] = useState(null);

  // Loading & freshness state
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Department table sorting
  const [deptSortField, setDeptSortField] = useState('totalAssigned');
  const [deptSortAsc, setDeptSortAsc] = useState(false);

  const queryParams = useMemo(() => {
    const params = { timeRange };
    if (timeRange === 'custom' && startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    if (category !== 'All') params.category = category;
    if (department !== 'All') params.department = department;
    if (zone !== 'All') params.zone = zone;
    return params;
  }, [timeRange, startDate, endDate, category, department, zone]);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, trRes, deptRes, recRes] = await Promise.all([
        getTransparencyOverview(queryParams),
        getCivicTrends(queryParams),
        getDepartmentPerformance(queryParams),
        getCivicImpactRecommendations(queryParams),
      ]);

      if (ovRes.success) setOverview(ovRes.data);
      if (trRes.success) setTrends(trRes.data);
      if (deptRes.success) setDepartments(deptRes.data);
      if (recRes.success) setRecommendations(recRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load civic transparency data:', err);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // Fetch public issues for explorer
  const fetchIssues = useCallback(async () => {
    try {
      const params = {
        page: 1,
        limit: 12,
        search: issuesSearch,
        status: issuesStatusFilter !== 'All' ? issuesStatusFilter : undefined,
        category: category !== 'All' ? category : undefined,
        department: department !== 'All' ? department : undefined,
        zone: zone !== 'All' ? zone : undefined,
      };
      const res = await getPublicMasterIssues(params);
      if (res.success) {
        setIssuesData(res.data);
      }
    } catch (err) {
      console.error('Failed to load public issues:', err);
    }
  }, [issuesSearch, issuesStatusFilter, category, department, zone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Open audit timeline modal
  const handleOpenTimeline = async (issue) => {
    setSelectedTimelineIssue(issue);
    setLoadingTimeline(true);
    try {
      const res = await getPublicIssueTimeline(issue._id || issue.id);
      if (res.success) {
        setTimelineData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch public timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Sort department data
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      let valA = a[deptSortField];
      let valB = b[deptSortField];
      if (typeof valA === 'string') {
        return deptSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = valA || 0;
      valB = valB || 0;
      return deptSortAsc ? valA - valB : valB - valA;
    });
  }, [departments, deptSortField, deptSortAsc]);

  const handleSortDept = (field) => {
    if (deptSortField === field) {
      setDeptSortAsc(!deptSortAsc);
    } else {
      setDeptSortField(field);
      setDeptSortAsc(false);
    }
  };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async (e) => {
    e?.preventDefault();
    if (isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);
      await downloadImpactReportPdf(queryParams);
    } catch (err) {
      alert(`Could not download impact PDF: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ------------------------------------------------------------------- */}
      {/* 1. EDITORIAL HEADER & FILTER BAR */}
      {/* ------------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E6E5DE]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs font-medium text-[#3E520A] mb-2">
              <span className="w-2 h-2 rounded-full bg-[#8CA81F] animate-pulse" />
              Public Accountability Console &bull; Phase 6 Live
            </div>
            <h1 className="font-editorial text-3xl sm:text-4xl text-[#191B1D] font-normal tracking-tight">
              Civic Transparency &amp; Public Impact Intelligence
            </h1>
            <p className="text-sm text-[#4B4E54] mt-1 max-w-2xl">
              Real-time telemetry and deterministic algorithmic audit of municipal service delivery, citizen grievances, SLA compliance, and cross-departmental operations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={fetchData}
              disabled={loading}
              className={loading ? 'animate-spin' : ''}
            >
              {loading ? 'Refreshing...' : 'Refresh Telemetry'}
            </Button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#191B1D] text-white hover:bg-[#2B2E33] shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <FileDown className={`w-3.5 h-3.5 text-[#D2E873] ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Impact Report (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="p-4 rounded-2xl bg-white border border-[#E6E5DE] shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs text-[#7E828B] pb-2 border-b border-[#F0EFEA]">
            <div className="flex items-center gap-2 font-medium text-[#191B1D]">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#8CA81F]" />
              <span>Telemetry Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8CA81F]" />
              <span>
                Data Freshness:{' '}
                {lastRefreshed ? lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Syncing...'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {/* Time Range Pills */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#7E828B] block">Reporting Window</label>
              <div className="flex items-center bg-[#F7F7F4] p-1 rounded-xl border border-[#E6E5DE]">
                {[
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: '90d', label: '90D' },
                  { id: 'all', label: 'All' },
                  { id: 'custom', label: 'Custom' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTimeRange(item.id);
                      setIsCustomRange(item.id === 'custom');
                    }}
                    className={`flex-1 py-1 rounded-lg text-xs font-medium transition-all ${
                      timeRange === item.id
                        ? 'bg-[#191B1D] text-white shadow-xs'
                        : 'text-[#4B4E54] hover:text-[#191B1D]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#7E828B] block">Civic Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Pothole &amp; Road Damage</option>
                <option value="Streetlight">Streetlight &amp; Electrical</option>
                <option value="Garbage">Garbage &amp; Sanitation</option>
                <option value="Water Leakage">Water Pipeline Leakage</option>
                <option value="Drainage">Drainage &amp; Sewage</option>
                <option value="Traffic Signal">Traffic Signal Failure</option>
                <option value="Fallen Tree">Fallen Tree / Debris</option>
                <option value="Other">Other Civic Issues</option>
              </select>
            </div>

            {/* Department Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#7E828B] block">Municipal Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
              >
                <option value="All">All Departments</option>
                <option value="Roads & Infrastructure">Roads &amp; Infrastructure</option>
                <option value="Electrical">Electrical Department</option>
                <option value="Sanitation">Sanitation &amp; Waste</option>
                <option value="Water Supply">Water Supply &amp; Pipelines</option>
                <option value="Drainage & Sewage">Drainage &amp; Sewage</option>
                <option value="Traffic Management">Traffic Management</option>
                <option value="Parks & Recreation">Parks &amp; Public Grounds</option>
              </select>
            </div>

            {/* Zone / Ward Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[#7E828B] block">Administrative Zone</label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
              >
                <option value="All">All City Wards</option>
                <option value="Central Ward">Central Ward</option>
                <option value="North Sector">North Sector</option>
                <option value="South Sector">South Sector</option>
                <option value="East Industrial">East Industrial</option>
                <option value="West Residential">West Residential</option>
              </select>
            </div>

            {/* Active Filters Reset */}
            <div className="space-y-1 flex flex-col justify-end">
              <button
                onClick={() => {
                  setTimeRange('30d');
                  setIsCustomRange(false);
                  setCategory('All');
                  setDepartment('All');
                  setZone('All');
                  setStartDate('');
                  setEndDate('');
                }}
                className="w-full text-xs py-2 px-3 rounded-xl bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#4B4E54] font-medium transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>

          {/* Custom Date Range Pickers (conditional) */}
          {isCustomRange && (
            <div className="pt-2 border-t border-[#F0EFEA] flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#7E828B]">Start Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-[#E6E5DE] bg-[#F7F7F4] text-[#191B1D]"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#7E828B]">End Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-[#E6E5DE] bg-[#F7F7F4] text-[#191B1D]"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* 2. EXECUTIVE CITYWIDE KPI BANNER */}
      {/* ------------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-xl sm:text-2xl text-[#191B1D]">
            Executive Transparency Scorecard
          </h2>
          <span className="text-xs text-[#7E828B]">
            Telemetry Scope: {overview?.filterSummary?.timeRangeLabel || 'Active Filter'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Citizen Complaints vs Master Issues */}
          <Card variant="white" padding="default" className="relative overflow-hidden space-y-2">
            <span className="text-xs text-[#7E828B] font-medium block">Intake Volume</span>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-editorial text-3xl sm:text-4xl text-[#191B1D]">
                  {overview?.totalComplaints || 0}
                </span>
                <span className="text-[11px] text-[#7E828B] block mt-0.5">Citizen Reports</span>
              </div>
              <div className="text-right">
                <span className="font-editorial text-2xl text-[#8CA81F]">
                  {overview?.totalMasterIssues || 0}
                </span>
                <span className="text-[11px] text-[#7E828B] block mt-0.5">Consolidated Master</span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#E6E5DE] text-[11px] text-[#4B4E54] flex justify-between">
              <span>Avg Grouping Ratio:</span>
              <span className="font-semibold text-[#191B1D]">
                {overview?.totalMasterIssues
                  ? `${(overview.totalComplaints / overview.totalMasterIssues).toFixed(1)} reports/issue`
                  : 'N/A'}
              </span>
            </div>
          </Card>

          {/* Card 2: Resolution Rate */}
          <Card variant="lime" padding="default" className="space-y-2">
            <span className="text-xs text-[#3E520A] font-medium block">Resolution Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="font-editorial text-3xl sm:text-4xl text-[#191B1D]">
                {overview?.totalMasterIssues > 0 || overview?.totalComplaints > 0
                  ? `${overview?.resolutionRate || 0}%`
                  : 'N/A'}
              </span>
              <span className="text-xs font-semibold text-[#3E520A]">
                {overview?.resolvedIssues || 0} Resolved
              </span>
            </div>
            {/* Resolution Progress Bar */}
            <div className="w-full bg-[#E5EDBC] h-2 rounded-full overflow-hidden mt-1">
              <div
                className="bg-[#8CA81F] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, overview?.resolutionRate || 0)}%` }}
              />
            </div>
            <div className="pt-1 text-[11px] text-[#3E520A] flex justify-between">
              <span>In Progress: {overview?.inProgressIssues || 0}</span>
              <span>Awaiting: {overview?.awaitingActionIssues || 0}</span>
            </div>
          </Card>

          {/* Card 3: SLA Compliance Rate */}
          <Card variant="lavender" padding="default" className="space-y-2">
            <span className="text-xs text-[#55478A] font-medium block">SLA Compliance Rate</span>
            <div className="flex items-baseline gap-2">
              <span className="font-editorial text-3xl sm:text-4xl text-[#191B1D]">
                {overview?.slaComplianceRate != null
                  ? `${overview.slaComplianceRate}%`
                  : 'N/A'}
              </span>
              {overview?.slaComplianceRate == null ? (
                <Badge variant="neutral" size="sm">
                  No Data
                </Badge>
              ) : overview?.overdueIssues > 0 ? (
                <Badge variant="rose" size="sm">
                  {overview.overdueIssues} Overdue
                </Badge>
              ) : (
                <Badge variant="sage" size="sm">
                  Zero Breaches
                </Badge>
              )}
            </div>
            <div className="pt-2 border-t border-[#DDD7F4] text-[11px] text-[#55478A] flex justify-between">
              <span>Overdue Escalations:</span>
              <span className="font-semibold text-[#191B1D]">{overview?.overdueIssues || 0}</span>
            </div>
          </Card>

          {/* Card 4: Average Resolution Time */}
          <Card variant="blue" padding="default" className="space-y-2">
            <span className="text-xs text-[#2C5370] font-medium block">Avg Resolution Duration</span>
            <div className="flex items-baseline gap-2">
              <span className="font-editorial text-3xl sm:text-4xl text-[#191B1D]">
                {overview?.avgResolutionHours != null
                  ? overview.avgResolutionHours
                  : 'N/A'}
              </span>
              {overview?.avgResolutionHours != null && (
                <span className="text-xs font-medium text-[#2C5370]">Hours</span>
              )}
            </div>
            <p className="text-[11px] text-[#2C5370] pt-2 border-t border-[#CDE0F3]">
              Calculated across all closed issues in selected date boundary.
            </p>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* 3. SECTION NAVIGATION TABS */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center justify-start border-b border-[#E6E5DE] gap-2 overflow-x-auto pb-px">
        {[
          { id: 'trends', label: 'Civic Trends & Hotspots', icon: BarChart3 },
          { id: 'departments', label: 'Department Scorecard', icon: Building2 },
          {
            id: 'recommendations',
            label: isAuthorityAuthenticated ? 'Municipal Recommendations' : 'Municipal Recommendations (Authority Only)',
            icon: Flame,
          },
          { id: 'issues', label: 'Public Issue Explorer', icon: Eye },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#191B1D] text-[#191B1D]'
                  : 'border-transparent text-[#7E828B] hover:text-[#191B1D]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#8CA81F]' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: CIVIC TRENDS & HOTSPOTS */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'trends' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Volume Over Time Chart & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart: Intake vs Resolution */}
            <div className="lg:col-span-7">
              <Card variant="white" padding="default" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-[#191B1D]">
                      Grievance Intake vs. Resolution Over Time
                    </h3>
                    <span className="text-xs text-[#7E828B]">
                      Daily trajectory of citizen submissions and verified closures
                    </span>
                  </div>
                  <Badge variant="sage" size="sm">
                    Live Stream
                  </Badge>
                </div>

                <div className="h-64 w-full pt-2">
                  {trends?.volumeOverTime && trends.volumeOverTime.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trends.volumeOverTime}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#191B1D" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#191B1D" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8CA81F" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8CA81F" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#7E828B"
                          fontSize={10}
                          tickLine={false}
                          tickFormatter={(val) => val.slice(5)}
                        />
                        <YAxis stroke="#7E828B" fontSize={10} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#191B1D',
                            color: '#fff',
                            borderRadius: '8px',
                            fontSize: '11px',
                            border: 'none',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Area
                          type="monotone"
                          dataKey="received"
                          name="Received"
                          stroke="#191B1D"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRec)"
                        />
                        <Area
                          type="monotone"
                          dataKey="resolved"
                          name="Resolved"
                          stroke="#8CA81F"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRes)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-[#7E828B]">
                      No intake activity recorded in selected timeframe.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Category Distribution Bar Chart */}
            <div className="lg:col-span-5">
              <Card variant="white" padding="default" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-[#191B1D]">
                      Category Distribution Breakdown
                    </h3>
                    <span className="text-xs text-[#7E828B]">
                      Share of total grievance volume by infrastructure domain
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {trends?.categoryDistribution && trends.categoryDistribution.length > 0 ? (
                    trends.categoryDistribution.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-[#191B1D]">{item.category}</span>
                          <span className="text-[#7E828B]">
                            {item.count} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-[#F0EFEA] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#191B1D] h-full rounded-full"
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#7E828B] text-center py-8">
                      No complaints for current filter.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Category Velocity Trends (Increasing / Decreasing with sample size validation) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-lg text-[#191B1D]">
                  Civic Category Velocity &amp; Trajectory
                </h3>
                <p className="text-xs text-[#7E828B]">
                  Comparative change against preceding period. Minimum sample size of 5 reports required for definitive trend classification.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {trends?.categoryTrends && trends.categoryTrends.length > 0 ? (
                trends.categoryTrends.map((tr, idx) => {
                  const isIncreasing = tr.trend === 'Increasing';
                  const isDecreasing = tr.trend === 'Decreasing';
                  return (
                    <Card key={idx} variant="white" padding="default" className="space-y-2">
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-semibold text-[#191B1D] line-clamp-1">
                          {tr.category}
                        </span>
                        {tr.sampleConfidence === 'Insufficient' ? (
                          <Badge variant="neutral" size="sm">
                            Low Sample ({tr.currentCount})
                          </Badge>
                        ) : isIncreasing ? (
                          <Badge variant="rose" size="sm" dot>
                            Increasing
                          </Badge>
                        ) : isDecreasing ? (
                          <Badge variant="sage" size="sm" dot>
                            Decreasing
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Stable
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="font-editorial text-2xl text-[#191B1D]">
                          {tr.currentCount}
                        </span>
                        <span className="text-xs text-[#7E828B]">reports</span>
                        {tr.sampleConfidence !== 'Insufficient' && (
                          <span
                            className={`text-xs font-semibold ml-auto flex items-center gap-0.5 ${
                              isIncreasing ? 'text-[#9E2B25]' : isDecreasing ? 'text-[#365734]' : 'text-[#7E828B]'
                            }`}
                          >
                            {isIncreasing ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : isDecreasing ? (
                              <TrendingDown className="w-3.5 h-3.5" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                            {tr.percentageChange > 0 ? `+${tr.percentageChange}%` : `${tr.percentageChange}%`}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-[#7E828B] pt-1 border-t border-[#F0EFEA] flex justify-between">
                        <span>Prior Window: {tr.previousCount}</span>
                        <span>{tr.sampleConfidence} Confidence</span>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-4 p-6 bg-white rounded-xl border border-[#E6E5DE] text-center text-xs text-[#7E828B]">
                  No trajectory data recorded.
                </div>
              )}
            </div>
          </section>

          {/* Recurring Problems & Persistent Hotspots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recurring Problems Card */}
            <Card variant="white" padding="default" className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0EFEA]">
                <div>
                  <h4 className="font-semibold text-sm text-[#191B1D]">
                    Recurring Civic Infrastructure Problems
                  </h4>
                  <span className="text-[11px] text-[#7E828B]">
                    Chronic recurring failures clustered in specific sectors
                  </span>
                </div>
                <Badge variant="amber" size="sm">
                  Chronic Warning
                </Badge>
              </div>

              <div className="space-y-2.5">
                {trends?.recurringProblems && trends.recurringProblems.length > 0 ? (
                  trends.recurringProblems.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#191B1D]">{p.category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF0DE] text-[#865917] font-medium">
                            {p.repeatCount || p.supportingReportCount || 1} Reports
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#7E828B] mt-1">
                          <MapPin className="w-3 h-3 text-[#8CA81F]" />
                          <span className="truncate max-w-xs">{p.location || 'Municipal Site'}</span>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-[#7E828B] shrink-0">
                        <span>Last Reported:</span>
                        <div className="font-medium text-[#191B1D]">
                          {p.lastReported && !isNaN(new Date(p.lastReported).getTime())
                            ? new Date(p.lastReported).toLocaleDateString()
                            : 'Recent'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[#7E828B] text-center py-6">
                    No recurring patterns meeting duplicate threshold.
                  </div>
                )}
              </div>
            </Card>

            {/* Persistent Hotspot Areas Card */}
            <Card variant="white" padding="default" className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#F0EFEA]">
                <div>
                  <h4 className="font-semibold text-sm text-[#191B1D]">
                    Geographical Hotspots Over Time
                  </h4>
                  <span className="text-[11px] text-[#7E828B]">
                    Areas with heavy complaint concentration and unresolved backlog
                  </span>
                </div>
                <Badge variant="rose" size="sm">
                  High Density
                </Badge>
              </div>

              <div className="space-y-2.5">
                {trends?.persistentAreas && trends.persistentAreas.length > 0 ? (
                  trends.persistentAreas.map((area, idx) => {
                    const unresolved = area.unresolvedIssues ?? area.unresolvedCount ?? 0;
                    const total = area.totalIssues ?? unresolved;
                    const overdue = area.overdueIssues ?? 0;
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#191B1D]">{area.zone}</span>
                            <Badge variant="charcoal" size="sm">
                              {total} Master Issue{total === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-[#7E828B]">
                            Unresolved Backlog: {unresolved} issue{unresolved === 1 ? '' : 's'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xs font-editorial font-bold ${
                              overdue > 0 ? 'text-[#9E2B25]' : 'text-[#3E520A]'
                            }`}
                          >
                            {overdue > 0 ? `${overdue} SLA Breach${overdue === 1 ? '' : 'es'}` : '0 Overdue (Within SLA)'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-[#7E828B] text-center py-6">
                    No persistent hotspot clusters identified.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: DEPARTMENT ACCOUNTABILITY SCORECARD */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'departments' && (
        <div className="space-y-6 animate-fadeIn">
          <Card variant="white" padding="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E6E5DE]">
              <div>
                <h3 className="font-editorial text-xl text-[#191B1D]">
                  Municipal Department Performance &amp; SLA Scorecard
                </h3>
                <p className="text-xs text-[#7E828B]">
                  Comparative evaluation of departmental resolution rates, cycle times, overdue backlogs, and SLA compliance.
                </p>
              </div>
              <span className="text-xs text-[#7E828B]">Click headers to sort</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E5DE] text-[#7E828B] font-medium">
                    <th
                      className="pb-3 cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('department')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Department</span>
                        {deptSortField === 'department' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('totalAssigned')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Total Assigned</span>
                        {deptSortField === 'totalAssigned' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('resolved')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Resolved</span>
                        {deptSortField === 'resolved' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('inProgress')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>In Progress</span>
                        {deptSortField === 'inProgress' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('overdue')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Overdue</span>
                        {deptSortField === 'overdue' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('resolutionRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Resolution %</span>
                        {deptSortField === 'resolutionRate' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('avgResolutionHours')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Avg Cycle Time</span>
                        {deptSortField === 'avgResolutionHours' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th
                      className="pb-3 text-center cursor-pointer hover:text-[#191B1D]"
                      onClick={() => handleSortDept('slaComplianceRate')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>SLA Compliance</span>
                        {deptSortField === 'slaComplianceRate' && (deptSortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th className="pb-3 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA]">
                  {sortedDepartments.map((dept, idx) => {
                    const isHighPerformer = dept.resolutionRate >= 70 && dept.overdue === 0 && dept.totalAssigned > 0;
                    const hasBacklog = dept.overdue > 0;
                    return (
                      <tr key={idx} className="hover:bg-[#F7F7F4]/80 transition-colors">
                        <td className="py-3 font-semibold text-[#191B1D]">
                          <div className="flex items-center gap-2">
                            <span>{dept.department}</span>
                            {isHighPerformer && (
                              <Badge variant="sage" size="sm">
                                Leader
                              </Badge>
                            )}
                            {hasBacklog && (
                              <Badge variant="rose" size="sm">
                                Overdue Alert
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-center font-mono">{dept.totalAssigned}</td>
                        <td className="py-3 text-center text-[#3E520A] font-semibold">{dept.resolved}</td>
                        <td className="py-3 text-center text-[#2C5370]">{dept.inProgress}</td>
                        <td className="py-3 text-center">
                          {dept.overdue > 0 ? (
                            <span className="font-semibold text-[#9E2B25]">{dept.overdue}</span>
                          ) : (
                            <span className="text-[#7E828B]">0</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-semibold">{dept.totalAssigned > 0 ? `${dept.resolutionRate}%` : '0%'}</span>
                            <div className="w-12 bg-[#F0EFEA] h-1.5 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="bg-[#8CA81F] h-full"
                                style={{ width: `${dept.totalAssigned > 0 ? dept.resolutionRate : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-center font-mono">
                          {dept.avgResolutionHours != null ? `${dept.avgResolutionHours}h` : '—'}
                        </td>
                        <td className="py-3 text-center">
                          {dept.slaComplianceRate != null ? (
                            <span
                              className={`font-semibold ${
                                dept.slaComplianceRate >= 80
                                  ? 'text-[#3E520A]'
                                  : dept.slaComplianceRate >= 50
                                  ? 'text-[#865917]'
                                  : 'text-[#9E2B25]'
                              }`}
                            >
                              {dept.slaComplianceRate}%
                            </span>
                          ) : (
                            <span className="text-[#7E828B]">N/A</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <Badge
                            variant={
                              dept.sampleConfidence === 'High'
                                ? 'sage'
                                : dept.sampleConfidence === 'Moderate'
                                ? 'blue'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {dept.sampleConfidence}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: CIVIC IMPACT & RESOURCE ALLOCATION INSIGHTS */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'recommendations' && (
        !isAuthorityAuthenticated ? (
          <div className="py-16 px-6 text-center max-w-md mx-auto space-y-4 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF0DE] border border-[#EEDBBA] text-[#C27803] flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#191B1D]">Municipal Administrator Access Required</h3>
              <p className="text-xs text-[#7E828B] leading-relaxed">
                Recommended municipal corrective measures, dispatch advisories, and cross-departmental resource allocation models are restricted strictly to authorized municipal officers.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setGlobalTab('authority-login')}
                className="gap-2"
              >
                <Building2 className="w-4 h-4" />
                Sign In as Municipal Administrator
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
          <div className="p-4 rounded-xl bg-[#F2F8D5] border border-[#D2E873] flex items-start gap-3">
            <Info className="w-5 h-5 text-[#8CA81F] shrink-0 mt-0.5" />
            <div className="text-xs text-[#3E520A] space-y-1">
              <span className="font-bold block">
                Deterministic Algorithmic Allocation Engine (Zero AI Quota Consumption)
              </span>
              <p>
                CivicPulse evaluates empirical backlog ratios, unresolved high-priority incidents, and recurring volume trajectories to calculate explainable, rule-based municipal resource recommendations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations && recommendations.length > 0 ? (
              recommendations.map((rec, idx) => {
                const isCritical = rec.urgency === 'CRITICAL';
                const isHigh = rec.urgency === 'HIGH';
                return (
                  <Card
                    key={idx}
                    variant="white"
                    padding="default"
                    className="space-y-3 border-l-4 border-l-[#8CA81F] relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#191B1D]">
                            {rec.category} &bull; {rec.area}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#7E828B] block mt-0.5">
                          Civic Impact Action Advisory #{idx + 1}
                        </span>
                      </div>
                      <Badge
                        variant={isCritical ? 'rose' : isHigh ? 'amber' : 'lime'}
                        size="sm"
                        dot
                      >
                        {rec.urgency} Urgency
                      </Badge>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] space-y-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#7E828B] block">
                        Recommended Municipal Action
                      </span>
                      <p className="text-xs font-semibold text-[#191B1D] leading-snug">
                        {rec.recommendation}
                      </p>
                    </div>

                    <div className="text-xs text-[#4B4E54] space-y-1">
                      <span className="text-[11px] font-medium text-[#7E828B] block">
                        Analytical Rationale:
                      </span>
                      <p className="leading-relaxed">{rec.analyticalReason}</p>
                    </div>

                    {rec.supportingData && (
                      <div className="pt-2 border-t border-[#F0EFEA] flex items-center justify-between text-[11px] text-[#7E828B]">
                        <span>Impact Scope:</span>
                        <span className="font-mono font-medium text-[#191B1D]">
                          {rec.supportingData.complaintCount} reports ({rec.supportingData.unresolvedCount} unresolved)
                        </span>
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <div className="col-span-2 p-8 bg-white rounded-2xl border border-[#E6E5DE] text-center text-xs text-[#7E828B]">
                All municipal departments are currently operating within nominal SLA targets. No resource reallocations recommended.
              </div>
            )}
          </div>
        </div>
      )
    )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 4: PUBLIC ISSUE EXPLORER & AUDIT TRANSPARENCY */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === 'issues' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Search & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-[#E6E5DE]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#7E828B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search master issues by ID, category, or locality..."
                value={issuesSearch}
                onChange={(e) => setIssuesSearch(e.target.value)}
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-lg pl-9 pr-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={issuesStatusFilter}
                onChange={(e) => setIssuesStatusFilter(e.target.value)}
                className="text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-lg px-3 py-2 text-[#191B1D] focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolution Submitted">Resolution Submitted</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Privacy Notice Pill */}
          <div className="flex items-center gap-2 text-xs text-[#7E828B] px-1">
            <Shield className="w-3.5 h-3.5 text-[#3E7295]" />
            <span>
              Public Privacy Protected: Citizen names, phone numbers, and internal officer notes are strictly redacted from public telemetry.
            </span>
          </div>

          {/* Master Issues Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {issuesData?.issues && issuesData.issues.length > 0 ? (
              issuesData.issues.map((issue) => {
                const isResolved = issue.status === 'Resolved';
                const hasPhotos = issue.representativeImage || issue.resolutionProofImage;
                return (
                  <Card
                    key={issue.masterIssueId || issue._id}
                    variant="white"
                    padding="default"
                    className="space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono text-[#7E828B]">
                          {issue.masterIssueId}
                        </span>
                        <Badge
                          variant={
                            isResolved
                              ? 'sage'
                              : issue.status === 'In Progress'
                              ? 'blue'
                              : issue.status === 'Resolution Submitted'
                              ? 'amber'
                              : 'neutral'
                          }
                          size="sm"
                          dot
                        >
                          {issue.status}
                        </Badge>
                      </div>

                      <h4 className="font-semibold text-sm text-[#191B1D] line-clamp-1">
                        {issue.category} &bull; {issue.location?.zone || 'Municipal Ward'}
                      </h4>

                      <p className="text-xs text-[#4B4E54] line-clamp-2 leading-relaxed">
                        {issue.title || issue.description || 'Consolidated municipal infrastructure report.'}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-[#7E828B]">
                        <MapPin className="w-3.5 h-3.5 text-[#8CA81F] shrink-0" />
                        <span className="truncate">{issue.location?.address || 'City Precinct'}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#F0EFEA]">
                      <div className="flex items-center justify-between text-[11px] text-[#4B4E54]">
                        <span>Assigned Department:</span>
                        <span className="font-medium text-[#191B1D]">
                          {issue.assignedDepartment || 'Public Works'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#4B4E54]">
                        <span>Affected Citizens:</span>
                        <span className="font-semibold text-[#8CA81F]">
                          {issue.citizenCount || 1} Community Reports
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleOpenTimeline(issue)}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#191B1D] transition-colors"
                        >
                          Public Audit Log
                        </button>

                        {isResolved && (issue.representativeImage || issue.resolutionProofImage) && (
                          <button
                            onClick={() => setComparisonIssue(issue)}
                            className="py-1.5 px-3 rounded-lg text-xs font-medium bg-[#D2E873] hover:bg-[#C4DC61] text-[#191B1D] transition-colors"
                          >
                            Before / After
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-3 p-12 bg-white rounded-2xl border border-[#E6E5DE] text-center text-xs text-[#7E828B]">
                No public master issues match your current search and filter settings.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: PUBLIC AUDIT TIMELINE */}
      {/* ------------------------------------------------------------------- */}
      {selectedTimelineIssue && (
        <div className="fixed inset-0 z-50 bg-[#191B1D]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E5DE] max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-start justify-between pb-3 border-b border-[#E6E5DE]">
              <div>
                <span className="text-[11px] font-mono text-[#7E828B]">
                  {selectedTimelineIssue.masterIssueId}
                </span>
                <h3 className="font-semibold text-base text-[#191B1D]">
                  Public Lifecycle &amp; Audit Trail
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedTimelineIssue(null);
                  setTimelineData(null);
                }}
                className="text-[#7E828B] hover:text-[#191B1D] text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            {loadingTimeline ? (
              <div className="py-8 text-center text-xs text-[#7E828B]">
                Loading verified timeline...
              </div>
            ) : timelineData ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#7E828B]">Category:</span>
                    <span className="font-semibold text-[#191B1D]">{timelineData.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7E828B]">Department:</span>
                    <span className="font-semibold text-[#191B1D]">{timelineData.assignedDepartment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#7E828B]">Current Status:</span>
                    <Badge variant="sage" size="sm">
                      {timelineData.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#E6E5DE]">
                  {timelineData.timeline && timelineData.timeline.length > 0 ? (
                    timelineData.timeline.map((event, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 pl-7">
                        <span className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#191B1D] border-2 border-white -translate-x-1/2" />
                        <div className="space-y-0.5 text-xs">
                          <span className="font-semibold text-[#191B1D] block">
                            {event.stage || event.action}
                          </span>
                          <span className="text-[11px] text-[#7E828B] block">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                          {event.note && (
                            <p className="text-[11px] text-[#4B4E54] pt-0.5">{event.note}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#7E828B] pl-7">No milestones logged yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* MODAL: BEFORE & AFTER PHOTO COMPARISON */}
      {/* ------------------------------------------------------------------- */}
      {comparisonIssue && (
        <div className="fixed inset-0 z-50 bg-[#191B1D]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E6E5DE] max-w-2xl w-full p-6 space-y-4 shadow-xl animate-fadeIn">
            <div className="flex items-start justify-between pb-3 border-b border-[#E6E5DE]">
              <div>
                <span className="text-[11px] font-mono text-[#7E828B]">
                  {comparisonIssue.masterIssueId}
                </span>
                <h3 className="font-semibold text-base text-[#191B1D]">
                  Verified Resolution Proof &bull; Before &amp; After
                </h3>
              </div>
              <button
                onClick={() => setComparisonIssue(null)}
                className="text-[#7E828B] hover:text-[#191B1D] text-xs font-semibold px-2 py-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#191B1D] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#9E2B25]" />
                  Initial Reported State
                </span>
                <div className="h-56 rounded-xl bg-[#F0EFEA] border border-[#E6E5DE] overflow-hidden flex items-center justify-center">
                  {comparisonIssue.representativeImage ? (
                    <img
                      src={comparisonIssue.representativeImage}
                      alt="Before Repair"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[#7E828B]">No initial photo attached</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#191B1D] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#8CA81F]" />
                  Verified Completion State
                </span>
                <div className="h-56 rounded-xl bg-[#F0EFEA] border border-[#E6E5DE] overflow-hidden flex items-center justify-center">
                  {comparisonIssue.resolutionProofImage ? (
                    <img
                      src={comparisonIssue.resolutionProofImage}
                      alt="After Repair"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[#7E828B]">No completion photo attached</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E6E5DE] flex items-center justify-between text-xs text-[#7E828B]">
              <span>Department: {comparisonIssue.assignedDepartment}</span>
              <Badge variant="sage" size="sm">
                Verified Resolution
              </Badge>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
