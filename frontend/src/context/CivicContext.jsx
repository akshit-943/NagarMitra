import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getComplaints,
  createComplaint,
  updateComplaintStatus,
  triggerAiAnalysis,
  getMasterIssues,
  getMasterIssueById,
  supportMasterIssue,
  getCivicHotspots,
  getPrioritySummary,
  resolvePotentialDuplicate,
  loginAuthority,
  logoutAuthority,
  registerCitizen,
  loginCitizen,
  logoutCitizen,
  getCitizenDashboardOverview,
  getMyComplaints,
  claimGuestComplaint,
  getFollowedMasterIssues,
  toggleFollowMasterIssue,
  getCitizenNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  updateCitizenProfile,
  changeCitizenPassword,
  forgotCitizenPassword,
} from '../services/complaintService';

const CivicContext = createContext();

export const CivicProvider = ({ children }) => {
  // Authority Authentication State
  const [authorityToken, setAuthorityToken] = useState(() => localStorage.getItem('civicpulse_token'));
  const [authorityUser, setAuthorityUser] = useState(() => {
    try {
      const saved = localStorage.getItem('civicpulse_authority_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const isAuthorityAuthenticated = Boolean(authorityToken && authorityUser);

  // Citizen Authentication State (Separate & Isolated from Authority)
  const [citizenToken, setCitizenToken] = useState(() => localStorage.getItem('civicpulse_citizen_token'));
  const [citizenUser, setCitizenUser] = useState(() => {
    try {
      const saved = localStorage.getItem('civicpulse_citizen_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const isCitizenAuthenticated = Boolean(citizenToken && citizenUser);

  // Citizen Personal Dashboard Data States
  const [citizenOverview, setCitizenOverview] = useState(null);
  const [myComplaints, setMyComplaints] = useState([]);
  const [followedIssues, setFollowedIssues] = useState([]);
  const [citizenNotifications, setCitizenNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const [liveComplaints, setLiveComplaints] = useState([]);
  const [masterIssues, setMasterIssues] = useState([]);
  const [hotspotsData, setHotspotsData] = useState({ totalHotspots: 0, hotspots: [] });
  const [prioritySummary, setPrioritySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('trackId') || null;
    } catch {
      return null;
    }
  });

  // Helper to parse route and query params from URL
  const getInitialRoute = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlTrackId = params.get('trackId');
      const urlMasterId =
        params.get('masterIssueId') ||
        (window.location.hash.startsWith('#/master-issues/')
          ? window.location.hash.replace('#/master-issues/', '')
          : null);
      const urlTab = params.get('tab');

      const authedAuthority = Boolean(localStorage.getItem('civicpulse_token'));
      const authedCitizen = Boolean(localStorage.getItem('civicpulse_citizen_token'));

      if (urlMasterId) {
        if (!authedAuthority) return { tab: 'authority-login', masterIssueId: urlMasterId };
        return { tab: 'master-issue-detail', masterIssueId: urlMasterId };
      }
      if (urlTrackId) {
        return { tab: 'citizen', masterIssueId: null };
      }
      if (urlTab === 'authority') {
        return { tab: authedAuthority ? 'authority' : 'authority-login', masterIssueId: null };
      }
      if (urlTab === 'dashboard') {
        return { tab: authedCitizen ? 'dashboard' : 'citizen-entry', masterIssueId: null };
      }
      if (urlTab && ['landing', 'citizen', 'public-map', 'about', 'citizen-entry', 'citizen-login', 'citizen-register', 'authority-login'].includes(urlTab)) {
        return { tab: urlTab, masterIssueId: null };
      }
    } catch {
      // Fallback
    }
    return { tab: 'landing', masterIssueId: null };
  };

  const initialRoute = getInitialRoute();
  const [activeTab, setActiveTabState] = useState(initialRoute.tab);
  const [selectedMasterIssueId, setSelectedMasterIssueId] = useState(initialRoute.masterIssueId);

  // Switch tabs with strict authentication route guards
  const setActiveTab = useCallback((tab) => {
    let targetTab = tab;

    // Guard: Authenticated Citizen user cannot access authority portal or duplicate auth pages
    if (isCitizenAuthenticated) {
      if (tab === 'authority' || tab === 'authority-login' || tab === 'master-issue-detail') {
        targetTab = 'dashboard';
      } else if (tab === 'citizen-login' || tab === 'citizen-register' || tab === 'citizen-entry') {
        targetTab = 'dashboard';
      }
    } else if (isAuthorityAuthenticated) {
      // Guard: Authenticated Authority personnel cannot access citizen login/register pages
      if (tab === 'citizen-entry' || tab === 'citizen-login' || tab === 'citizen-register' || tab === 'dashboard') {
        targetTab = 'authority';
      } else if (tab === 'authority-login') {
        targetTab = 'authority';
      }
    } else {
      // Guard: Unauthenticated visitors
      if (tab === 'authority' || tab === 'master-issue-detail') {
        targetTab = 'authority-login';
      } else if (tab === 'dashboard') {
        targetTab = 'citizen-entry';
      }
    }

    setActiveTabState(targetTab);
    if (targetTab !== 'master-issue-detail') {
      setSelectedMasterIssueId(null);
      const newUrl = targetTab === 'landing' ? window.location.pathname : `?tab=${targetTab}`;
      window.history.pushState({ tab: targetTab }, '', newUrl);
    }
  }, [isAuthorityAuthenticated, isCitizenAuthenticated]);

  // Citizen Authentication Handlers
  const registerCitizenUser = async (userData) => {
    const data = await registerCitizen(userData);
    if (data.token) {
      setCitizenToken(data.token);
      setCitizenUser(data.user);
      setActiveTabState('dashboard');
      window.history.pushState({ tab: 'dashboard' }, '', '?tab=dashboard');
    }
    return data;
  };

  const loginCitizenUser = async (credentials) => {
    const data = await loginCitizen(credentials);
    if (data.token) {
      setCitizenToken(data.token);
      setCitizenUser(data.user);
      setActiveTabState('dashboard');
      window.history.pushState({ tab: 'dashboard' }, '', '?tab=dashboard');
    }
    return data;
  };

  const logoutCitizenUser = () => {
    logoutCitizen();
    setCitizenToken(null);
    setCitizenUser(null);
    setCitizenOverview(null);
    setMyComplaints([]);
    setFollowedIssues([]);
    setCitizenNotifications([]);
    setUnreadNotificationsCount(0);
    setActiveTabState('landing');
    window.history.pushState({ tab: 'landing' }, '', window.location.pathname);
  };

  // Authority login handler
  const loginAuthorityUser = async (credentials) => {
    const data = await loginAuthority(credentials);
    if (data.token) {
      setAuthorityToken(data.token);
      setAuthorityUser(data.user);
      setActiveTabState('authority');
      window.history.pushState({ tab: 'authority' }, '', '?tab=authority');
    }
    return data;
  };

  // Authority logout handler
  const logoutAuthorityUser = async () => {
    await logoutAuthority();
    setAuthorityToken(null);
    setAuthorityUser(null);
    setActiveTabState('landing');
    window.history.pushState({ tab: 'landing' }, '', window.location.pathname);
  };

  // Direct navigation to dedicated Master Issue Details page (Authority only)
  const navigateToMasterIssue = useCallback((id) => {
    if (!id) return;
    if (!isAuthorityAuthenticated) {
      setActiveTabState('authority-login');
      return;
    }
    setSelectedMasterIssueId(id);
    setActiveTabState('master-issue-detail');
    const newUrl = `?tab=authority&masterIssueId=${encodeURIComponent(id)}`;
    window.history.pushState({ tab: 'master-issue-detail', masterIssueId: id }, '', newUrl);
  }, [isAuthorityAuthenticated]);

  // Return to Municipal Command queue
  const returnFromMasterIssue = useCallback(() => {
    setSelectedMasterIssueId(null);
    setActiveTabState('authority');
    window.history.pushState({ tab: 'authority' }, '', '?tab=authority');
  }, []);

  // Handle browser Back / Forward buttons seamlessly
  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRoute();
      setActiveTabState(route.tab);
      setSelectedMasterIssueId(route.masterIssueId);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Fetch live complaints from backend
  const fetchLiveComplaints = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getComplaints(filters);
      if (res.success) {
        setLiveComplaints(res.data || []);
        setPagination({
          page: res.page || 1,
          total: res.total || 0,
          totalPages: res.totalPages || 1,
        });
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Backend fetch error:', err.message);
      setError(err.message || 'Failed to connect to backend complaint registry');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Master Issues
  const fetchLiveMasterIssues = useCallback(async (filters = {}) => {
    try {
      const res = await getMasterIssues(filters);
      if (res.success) {
        setMasterIssues(res.data || []);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Master issues fetch error:', err.message);
    }
  }, []);

  // Fetch Hotspots
  const fetchHotspots = useCallback(async (params = {}) => {
    try {
      const res = await getCivicHotspots(params);
      if (res.success && res.data) {
        setHotspotsData(res.data);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Hotspots fetch error:', err.message);
    }
  }, []);

  // Fetch Priority Summary
  const fetchPrioritySummaryData = useCallback(async () => {
    try {
      const res = await getPrioritySummary();
      if (res.success && res.data) {
        setPrioritySummary(res.data);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Priority summary error:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchLiveComplaints();
    fetchLiveMasterIssues();
    fetchHotspots();
    fetchPrioritySummaryData();
  }, [fetchLiveComplaints, fetchLiveMasterIssues, fetchHotspots, fetchPrioritySummaryData]);

  // Citizen Dashboard Data Handlers
  const fetchCitizenOverview = useCallback(async () => {
    if (!isCitizenAuthenticated) return;
    try {
      const res = await getCitizenDashboardOverview();
      if (res.success && res.data) {
        setCitizenOverview(res.data);
        setMyComplaints(res.data.recentComplaints || []);
        setFollowedIssues(res.data.followedIssues || []);
        setUnreadNotificationsCount(res.data.stats?.unreadNotificationsCount || 0);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Citizen overview fetch error:', err.message);
    }
  }, [isCitizenAuthenticated]);

  const fetchMyComplaintsList = useCallback(async (filters = {}) => {
    if (!isCitizenAuthenticated) return;
    try {
      const res = await getMyComplaints(filters);
      if (res.success && res.data) {
        setMyComplaints(res.data);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] My complaints fetch error:', err.message);
    }
  }, [isCitizenAuthenticated]);

  const fetchNotificationsList = useCallback(async () => {
    if (!isCitizenAuthenticated) return;
    try {
      const res = await getCitizenNotifications();
      if (res.success && res.data) {
        setCitizenNotifications(res.data);
        setUnreadNotificationsCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn('⚠️ [CivicContext] Notifications error:', err.message);
    }
  }, [isCitizenAuthenticated]);

  const claimComplaintAction = async (complaintId, trackingToken) => {
    const res = await claimGuestComplaint(complaintId, trackingToken);
    if (res.success) {
      await fetchCitizenOverview();
      await fetchMyComplaintsList();
      await fetchNotificationsList();
    }
    return res;
  };

  // Submit actual complaint to backend
  const submitComplaint = async (data, imageFile = null) => {
    const result = await createComplaint(data, imageFile);
    if (result.success && result.data) {
      setLiveComplaints((prev) => [result.data, ...prev]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
      fetchLiveMasterIssues();
      fetchHotspots();
      fetchPrioritySummaryData();

      // If registered citizen submitted, update personal dashboard immediately
      if (isCitizenAuthenticated) {
        setMyComplaints((prev) => [
          result.data,
          ...prev.filter(
            (c) =>
              (c.complaintId || c._id) !==
              (result.data.complaintId || result.data._id)
          ),
        ]);
        fetchCitizenOverview();
        fetchMyComplaintsList();
        fetchNotificationsList();
      }
    }
    return result;
  };

  // Update status on backend
  const updateStatus = async (id, newStatus, note, changedBy) => {
    const result = await updateComplaintStatus(id, {
      status: newStatus,
      note,
      changedBy,
    });
    if (result.success && result.data) {
      setLiveComplaints((prev) =>
        prev.map((c) =>
          c.complaintId === id || c._id === id ? result.data : c
        )
      );
      fetchLiveMasterIssues();
    }
    return result;
  };

  // Citizen Endorsement: "I am also affected"
  const endorseIssue = async (masterIssueId) => {
    const result = await supportMasterIssue(masterIssueId);
    if (result.success) {
      setMasterIssues((prev) =>
        prev.map((mi) =>
          mi.masterIssueId === masterIssueId
            ? {
                ...mi,
                citizenSupportCount: result.citizenSupportCount,
                priority: result.priority || mi.priority,
                hasSupported: true,
              }
            : mi
        )
      );
      fetchPrioritySummaryData();
    }
    return result;
  };

  // Resolve potential duplicate
  const resolveDuplicateAction = async (masterIssueId, complaintId, action) => {
    const result = await resolvePotentialDuplicate(masterIssueId, complaintId, action);
    if (result.success) {
      fetchLiveMasterIssues();
      fetchLiveComplaints();
    }
    return result;
  };

  // Retry or trigger Gemini AI analysis
  const retryAiAnalysis = async (id) => {
    const result = await triggerAiAnalysis(id);
    if (result.data) {
      setLiveComplaints((prev) =>
        prev.map((c) =>
          c.complaintId === id || c._id === id ? result.data : c
        )
      );
      fetchLiveMasterIssues();
      fetchHotspots();
      fetchPrioritySummaryData();
      if (isCitizenAuthenticated) {
        fetchCitizenOverview();
        fetchNotificationsList();
      }
    }
    return result;
  };

  const markNotificationAsRead = async (id) => {
    const res = await markNotificationRead(id);
    if (res.success) {
      setCitizenNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    }
    return res;
  };

  const markAllNotificationsAsReadAction = async () => {
    const res = await markAllNotificationsRead();
    if (res.success) {
      setCitizenNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotificationsCount(0);
    }
    return res;
  };

  const toggleFollowAction = async (masterIssueId) => {
    const res = await toggleFollowMasterIssue(masterIssueId);
    if (res.success) {
      await fetchCitizenOverview();
      await fetchNotificationsList();
    }
    return res;
  };

  useEffect(() => {
    if (isCitizenAuthenticated) {
      fetchCitizenOverview();
      fetchNotificationsList();
    }
  }, [isCitizenAuthenticated, fetchCitizenOverview, fetchNotificationsList]);

  const dynamicStats = useMemo(() => {
    const totalReports = pagination.total || liveComplaints.length;
    const resolvedCount = liveComplaints.filter((c) => c.status === 'Resolved').length;
    const resolutionRate = totalReports > 0 ? `${Math.round((resolvedCount / totalReports) * 100)}%` : '0%';
    return {
      totalReports,
      resolvedCount,
      resolutionRate,
      medianFirstResponse: totalReports > 0 ? '18m' : 'N/A',
      activeWards: 0,
      participatingCitizens: 0,
    };
  }, [pagination.total, liveComplaints]);

  return (
    <CivicContext.Provider
      value={{
        complaints: liveComplaints,
        masterIssues,
        hotspots: hotspotsData.hotspots || [],
        hotspotsMeta: hotspotsData,
        prioritySummary,
        loading,
        error,
        pagination,
        stats: dynamicStats,
        activeTab,
        setActiveTab,
        navigateToMasterIssue,
        returnFromMasterIssue,
        isSubmitModalOpen,
        setIsSubmitModalOpen,
        selectedComplaintId,
        setSelectedComplaintId,
        selectedMasterIssueId,
        setSelectedMasterIssueId,
        submitComplaint,
        updateStatus,
        endorseIssue,
        resolveDuplicateAction,
        retryAiAnalysis,
        // Authority Authentication
        authorityUser,
        authorityToken,
        isAuthorityAuthenticated,
        loginAuthorityUser,
        logoutAuthorityUser,
        fetchLiveComplaints,
        fetchLiveMasterIssues,
        fetchHotspots,
        fetchPrioritySummaryData,
        // Citizen Authentication & Dashboard
        citizenUser,
        citizenToken,
        isCitizenAuthenticated,
        registerCitizenUser,
        loginCitizenUser,
        logoutCitizenUser,
        citizenOverview,
        myComplaints,
        followedIssues,
        citizenNotifications,
        unreadNotificationsCount,
        fetchCitizenOverview,
        fetchMyComplaints: fetchMyComplaintsList,
        claimComplaint: claimComplaintAction,
        toggleFollowIssue: toggleFollowAction,
        fetchCitizenNotifications: fetchNotificationsList,
        markNotificationRead: markNotificationAsRead,
        markAllNotificationsRead: markAllNotificationsAsReadAction,
      }}
    >
      {children}
    </CivicContext.Provider>
  );
};

export const useCivic = () => {
  const context = useContext(CivicContext);
  if (!context) {
    throw new Error('useCivic must be used within a CivicProvider');
  }
  return context;
};
