import React from 'react';
import { CivicProvider, useCivic } from './context/CivicContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import CitizenDashboard from './pages/CitizenDashboard';
import AuthorityDashboard from './pages/AuthorityDashboard';
import MasterIssueDetailsPage from './pages/MasterIssueDetailsPage';
import AuthorityLoginPage from './pages/AuthorityLoginPage';
import PublicMapPage from './pages/PublicMapPage';
import AboutPage from './pages/AboutPage';
import CitizenEntryPage from './pages/CitizenEntryPage';
import CitizenLoginPage from './pages/CitizenLoginPage';
import CitizenRegisterPage from './pages/CitizenRegisterPage';
import PersonalCitizenDashboard from './pages/PersonalCitizenDashboard';
import ReportIssueModal from './components/ReportIssueModal';
import ComplaintDetailsModal from './components/ComplaintDetailsModal';
import CivicAssistant from './components/assistant/CivicAssistant';
import ErrorBoundary from './components/ui/ErrorBoundary';

function AppContent() {
  const {
    activeTab,
    setActiveTab,
    isSubmitModalOpen,
    setIsSubmitModalOpen,
    selectedComplaintId,
    setSelectedComplaintId,
    selectedMasterIssueId,
    returnFromMasterIssue,
    isAuthorityAuthenticated,
    isCitizenAuthenticated,
  } = useCivic();

  // Reset window scroll position to top whenever switching platform tabs
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#191B1D] flex flex-col font-sans selection:bg-[#D2E873] selection:text-[#191B1D]">
      {/* Editorial Navigation */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'landing' && <LandingPage />}
        {activeTab === 'citizen' && <CitizenDashboard />}
        {activeTab === 'public-map' && <PublicMapPage />}
        {activeTab === 'about' && <AboutPage />}
        {activeTab === 'citizen-entry' && (
          isAuthorityAuthenticated ? <AuthorityDashboard /> : isCitizenAuthenticated ? <PersonalCitizenDashboard /> : <CitizenEntryPage />
        )}
        {activeTab === 'citizen-login' && (
          isAuthorityAuthenticated ? <AuthorityDashboard /> : isCitizenAuthenticated ? <PersonalCitizenDashboard /> : <CitizenLoginPage />
        )}
        {activeTab === 'citizen-register' && (
          isAuthorityAuthenticated ? <AuthorityDashboard /> : isCitizenAuthenticated ? <PersonalCitizenDashboard /> : <CitizenRegisterPage />
        )}
        {activeTab === 'dashboard' && (
          isCitizenAuthenticated ? <PersonalCitizenDashboard /> : <CitizenEntryPage />
        )}
        {activeTab === 'authority-login' && (
          isCitizenAuthenticated ? <PersonalCitizenDashboard /> : isAuthorityAuthenticated ? <AuthorityDashboard /> : <AuthorityLoginPage />
        )}
        {activeTab === 'authority' && (
          isAuthorityAuthenticated ? <AuthorityDashboard /> : isCitizenAuthenticated ? <PersonalCitizenDashboard /> : <AuthorityLoginPage />
        )}
        {activeTab === 'master-issue-detail' && (
          isAuthorityAuthenticated ? (
            <MasterIssueDetailsPage
              masterIssueId={selectedMasterIssueId}
              onBack={returnFromMasterIssue}
            />
          ) : isCitizenAuthenticated ? (
            <PersonalCitizenDashboard />
          ) : (
            <AuthorityLoginPage />
          )
        )}
      </main>

      {/* Global Citizen Complaint Submission Modal */}
      <ReportIssueModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
      />

      {/* Global Complaint Details Inspector Modal */}
      <ComplaintDetailsModal
        complaintId={selectedComplaintId}
        isOpen={Boolean(selectedComplaintId)}
        onClose={() => setSelectedComplaintId(null)}
      />

      {/* Global Conversational AI Assistant */}
      <CivicAssistant />

      {/* Minimal Editorial Footer (rendered on content views, omitted on focused auth cards) */}
      {!['authority-login', 'citizen-login', 'citizen-register', 'citizen-entry'].includes(activeTab) && (
        <footer className="border-t border-[#E6E5DE] bg-[#F7F7F4] py-12 text-xs text-[#7E828B] mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#E6E5DE]">
              <div className="space-y-2 md:col-span-2 max-w-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#191B1D]" />
                  <span className="font-semibold text-sm text-[#191B1D]">CivicPulse AI</span>
                </div>
                <p className="text-xs text-[#7E828B] leading-relaxed">
                  Intelligent civic infrastructure reporting, triaging, and municipal accountability platform. Designed for modern cities with restrained editorial clarity.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#191B1D]">
                  Platform Portals
                </span>
                <ul className="space-y-1.5 text-xs text-[#4B4E54]">
                  <li>
                    <button onClick={() => setActiveTab('landing')} className="hover:text-[#191B1D]">
                      Home Overview
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setActiveTab('citizen')} className="hover:text-[#191B1D]">
                      Citizen Portal (Guest)
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setActiveTab('public-map')} className="hover:text-[#191B1D]">
                      Public Infrastructure Map
                    </button>
                  </li>
                  {(!isAuthorityAuthenticated || isCitizenAuthenticated) && (
                    <li>
                      <button onClick={() => setActiveTab(isCitizenAuthenticated ? 'dashboard' : 'citizen-entry')} className="hover:text-[#191B1D]">
                        {isCitizenAuthenticated ? 'Your Personal Dashboard' : 'Citizen Account / Login'}
                      </button>
                    </li>
                  )}
                  {(!isCitizenAuthenticated || isAuthorityAuthenticated) && (
                    <li>
                      <button onClick={() => setActiveTab(isAuthorityAuthenticated ? 'authority' : 'authority-login')} className="hover:text-[#191B1D]">
                        {isAuthorityAuthenticated ? 'Municipal Command' : 'Authority Personnel Login'}
                      </button>
                    </li>
                  )}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#191B1D]">
                  Transparency &amp; Governance
                </span>
                <ul className="space-y-1.5 text-xs text-[#4B4E54]">
                  <li>
                    <button onClick={() => setActiveTab('about')} className="hover:text-[#191B1D]">
                      About Platform
                    </button>
                  </li>
                  <li><span className="hover:text-[#191B1D] cursor-pointer">Municipal SLA Standards</span></li>
                  <li><span className="hover:text-[#191B1D] cursor-pointer">Open Incident Data</span></li>
                  <li><span className="hover:text-[#191B1D] cursor-pointer">Privacy &amp; Encryption</span></li>
                </ul>
              </div>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#A2A6B0]">
              <div>
                &copy; {new Date().getFullYear()} CivicPulse AI Technologies Inc. All rights reserved.
              </div>
              <div className="flex items-center gap-4">
                <span>Warm Off-White &bull; Deep Charcoal &bull; Soft Lime</span>
                <span>v2.0 Design System</span>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CivicProvider>
        <AppContent />
      </CivicProvider>
    </ErrorBoundary>
  );
}
