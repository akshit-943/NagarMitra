import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useCivic } from '../context/CivicContext';
import { forgotCitizenPassword } from '../services/complaintService';
import {
  LogIn,
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  X,
} from 'lucide-react';

export default function CitizenLoginPage() {
  const { loginCitizenUser, setActiveTab } = useCivic();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotStatus, setForgotStatus] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please provide your email address or mobile number and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await loginCitizenUser({
        identifier: identifier.trim(),
        password,
      });
      // Context will redirect to 'dashboard'
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) return;

    try {
      setForgotLoading(true);
      setForgotStatus(null);
      const res = await forgotCitizenPassword(forgotIdentifier.trim());
      setForgotStatus({
        type: 'info',
        message: res.message,
      });
    } catch (err) {
      setForgotStatus({
        type: 'error',
        message: err.message || 'Could not process recovery inquiry.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <Card className="p-8 border border-[#E6E5DE] shadow-sm bg-white">
        <div className="text-center space-y-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#191B1D] text-white flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-5 h-5 text-[#D2E873]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#191B1D] tracking-tight">
            Citizen Login
          </h1>
          <p className="text-xs text-[#7E828B]">
            Sign in to access your personal complaint portfolio and notifications.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-[#FBEAE9] border border-[#F1B5B2] flex items-start gap-2.5 text-xs text-[#9E2B25]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Email Address or Mobile Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="citizen@example.com or +91 9876543210"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <User className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#4B4E54]">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotIdentifier(identifier);
                  setIsForgotModalOpen(true);
                }}
                className="text-xs text-[#7E828B] hover:text-[#191B1D] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <Lock className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#7E828B] hover:text-[#191B1D]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center shadow-xs"
              loading={loading}
            >
              Log In to Your Dashboard
            </Button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-[#E6E5DE] space-y-3 text-center text-xs text-[#7E828B]">
          <div>
            Don't have an account?{' '}
            <button
              onClick={() => setActiveTab('citizen-register')}
              className="font-medium text-[#191B1D] hover:underline"
            >
              Sign up for free
            </button>
          </div>
          <div>
            <button
              onClick={() => setActiveTab('citizen')}
              className="text-[#7E828B] hover:text-[#191B1D] inline-flex items-center gap-1 transition-colors"
            >
              <span>Continue as guest without signing in</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Transparent Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E6E5DE] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6E5DE]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#8CA81F]" />
                <h3 className="font-semibold text-base text-[#191B1D]">Account Recovery</h3>
              </div>
              <button
                onClick={() => {
                  setIsForgotModalOpen(false);
                  setForgotStatus(null);
                }}
                className="text-[#7E828B] hover:text-[#191B1D]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#4B4E54] leading-relaxed">
              NagarMitra respects privacy and operates without compulsory third-party SMS or email trackers.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#4B4E54] mb-1">
                  Registered Email or Phone
                </label>
                <input
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Enter email or mobile number"
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] focus:bg-white focus:outline-none focus:border-[#191B1D]"
                  required
                />
              </div>

              {forgotStatus && (
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    forgotStatus.type === 'error'
                      ? 'bg-[#FBEAE9] border border-[#F1B5B2] text-[#9E2B25]'
                      : 'bg-[#F2F8D5] border border-[#D2E873] text-[#3E520A]'
                  }`}
                >
                  {forgotStatus.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotStatus(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={forgotLoading}
                >
                  Check Recovery Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
