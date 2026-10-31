import React, { useState } from 'react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { useCivic } from '../context/CivicContext';
import {
  Menu,
  X,
  PlusCircle,
  LogOut,
  Shield,
  User,
  Bell,
  MapPin,
  Compass,
  LayoutDashboard,
  CheckCircle,
} from 'lucide-react';

export default function Navbar() {
  const {
    activeTab,
    setActiveTab,
    setIsSubmitModalOpen,
    authorityUser,
    isAuthorityAuthenticated,
    logoutAuthorityUser,
    citizenUser,
    isCitizenAuthenticated,
    logoutCitizenUser,
    unreadNotificationsCount,
  } = useCivic();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic Navigation Items
  const navItems = [
    { id: 'landing', label: 'Home' },
    { id: 'citizen', label: 'Citizen Portal' },
    { id: 'public-map', label: 'Public Map' },
    { id: 'about', label: 'About' },
  ];

  if (isCitizenAuthenticated) {
    navItems.push({ id: 'dashboard', label: 'Your Dashboard' });
  } else if (isAuthorityAuthenticated) {
    navItems.push({ id: 'authority', label: 'Municipal Command' });
  }

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F7F7F4]/90 backdrop-blur-md border-b border-[#E6E5DE]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-full bg-[#191B1D] flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D2E873]" />
          </div>
          <div>
            <span className="font-semibold text-base tracking-tight text-[#191B1D] block leading-none">
              CivicPulse<span className="font-editorial italic font-normal text-sm text-[#7E828B] ml-1">AI</span>
            </span>
            <span className="text-[10px] text-[#7E828B] font-medium tracking-wide uppercase">
              Civic Technology
            </span>
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        <nav className="hidden lg:flex items-center bg-[#F0EFEA] p-1 rounded-full border border-[#E6E5DE]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#191B1D] text-white shadow-xs'
                    : 'text-[#4B4E54] hover:text-[#191B1D]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions & Profiles */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Citizen Session Section */}
          {isCitizenAuthenticated && citizenUser ? (
            <div className="flex items-center gap-2">
              {/* Notification Bell */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="relative p-2 rounded-full hover:bg-[#F0EFEA] text-[#4B4E54] hover:text-[#191B1D] transition-colors"
                title={`${unreadNotificationsCount} unread notification(s)`}
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#8CA81F] rounded-full border-2 border-[#F7F7F4]" />
                )}
              </button>

              {/* Citizen User Chip */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0EFEA] border border-[#E6E5DE] text-xs hover:border-[#191B1D] transition-colors"
              >
                <User className="w-3.5 h-3.5 text-[#191B1D]" />
                <span className="font-medium text-[#191B1D] max-w-[100px] truncate">{citizenUser.name}</span>
              </button>

              <Button
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={logoutCitizenUser}
                title="Log out of Citizen Dashboard"
              >
                Log Out
              </Button>
            </div>
          ) : isAuthorityAuthenticated && authorityUser ? (
            /* Authority Session Section */
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('authority')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs text-[#3E520A] font-medium"
              >
                <Shield className="w-3.5 h-3.5 text-[#8CA81F]" />
                <span className="max-w-[100px] truncate">{authorityUser.name}</span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                icon={LogOut}
                onClick={logoutAuthorityUser}
                title="Log out of Authority Session"
              >
                Exit Command
              </Button>
            </div>
          ) : (
            /* Unauthenticated Public Actions */
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('citizen-entry')}
                className={activeTab === 'citizen-entry' || activeTab === 'citizen-login' || activeTab === 'citizen-register' ? 'border-[#191B1D] font-medium' : ''}
              >
                Login / Sign Up
              </Button>

              <button
                onClick={() => setActiveTab('authority-login')}
                className={`text-xs px-2.5 py-1.5 rounded-lg text-[#7E828B] hover:text-[#191B1D] transition-colors ${
                  activeTab === 'authority-login' ? 'text-[#191B1D] font-semibold' : ''
                }`}
              >
                Authority Login
              </button>
            </div>
          )}

          {/* Report an Issue CTA */}
          <Button
            variant="primary"
            size="sm"
            icon={PlusCircle}
            onClick={() => setIsSubmitModalOpen(true)}
            className="ml-1"
          >
            Report an Issue
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
          >
            Report
          </Button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-full text-[#191B1D] hover:bg-[#F0EFEA]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E6E5DE] bg-[#F7F7F4] px-4 py-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-[#191B1D] text-white'
                  : 'text-[#4B4E54] hover:bg-[#F0EFEA]'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="pt-2 border-t border-[#E6E5DE] space-y-2">
            {isCitizenAuthenticated ? (
              <button
                onClick={() => {
                  logoutCitizenUser();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 rounded-xl text-xs font-medium text-[#9E2B25] hover:bg-[#FBEAE9] flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out Citizen ({citizenUser?.name})</span>
              </button>
            ) : isAuthorityAuthenticated ? (
              <button
                onClick={() => {
                  logoutAuthorityUser();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 rounded-xl text-xs font-medium text-[#9E2B25] hover:bg-[#FBEAE9] flex items-center gap-2"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Log Out Authority ({authorityUser?.name})</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('citizen-entry')}
                  className="w-full text-left px-4 py-2 rounded-xl text-xs font-medium text-[#191B1D] hover:bg-[#F0EFEA] flex items-center gap-2"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Citizen Login / Sign Up</span>
                </button>
                <button
                  onClick={() => handleNavClick('authority-login')}
                  className="w-full text-left px-4 py-2 rounded-xl text-xs font-medium text-[#7E828B] hover:text-[#191B1D] flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Authority Personnel Login</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
