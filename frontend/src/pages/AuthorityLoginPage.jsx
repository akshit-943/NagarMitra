import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useCivic } from '../context/CivicContext';
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  KeyRound,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function AuthorityLoginPage() {
  const { loginAuthorityUser, setActiveTab } = useCivic();

  const [authorityId, setAuthorityId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!authorityId.trim()) {
      setErrorMessage('Please enter your Authority ID or official municipal email.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your security password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await loginAuthorityUser({
        authorityId: authorityId.trim(),
        password,
      });
      // Redirect happens automatically inside loginAuthorityUser
    } catch (err) {
      setErrorMessage(
        err.message || 'Authentication failed. Please verify your Authority ID and password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoCredentials = (id) => {
    setAuthorityId(id);
    setPassword('CivicPulse@2026');
    setErrorMessage(null);
  };

  // Ensure view starts strictly at top of viewport on mount
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-2 sm:py-6 px-4">
      <div className="text-center space-y-2.5 mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ECE8F9] border border-[#DDD7F4] text-xs font-medium text-[#55478A] shadow-xs">
          <Shield className="w-3.5 h-3.5 text-[#7C6EB0]" />
          <span>Municipal Authority Restricted Zone</span>
        </div>
        <h1 className="font-editorial text-2xl sm:text-3xl text-[#191B1D] font-normal tracking-tight">
          Authority Command Access
        </h1>
        <p className="text-xs sm:text-sm text-[#4B4E54] max-w-md mx-auto">
          Protected portal for Municipal Officers, Department Supervisors, and System Administrators.
        </p>
      </div>

      <Card variant="white" padding="default" className="shadow-lg border-[#E6E5DE] space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-[#9E2B25] text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Authentication Error</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#191B1D] mb-1.5">
              Authority ID or Municipal Email *
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. AUTH-ADMIN-01 or OFF-MPW-01"
                value={authorityId}
                onChange={(e) => setAuthorityId(e.target.value)}
                required
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl px-3.5 py-2.5 text-[#191B1D] font-mono focus:outline-none focus:border-[#8CA81F] transition-colors"
              />
              <KeyRound className="w-4 h-4 text-[#7E828B] absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#191B1D] mb-1.5">
              Security Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your security password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl pl-3.5 pr-10 py-2.5 text-[#191B1D] focus:outline-none focus:border-[#8CA81F] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7E828B] hover:text-[#191B1D] p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSubmitting}
            className="w-full font-semibold shadow-xs"
          >
            {isSubmitting ? 'Authenticating Credentials...' : 'Authenticate & Enter Command'}
          </Button>
        </form>

        {/* Controlled Provisioning Disclaimer */}
        <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#191B1D] font-semibold">
            <Info className="w-3.5 h-3.5 text-[#8CA81F]" />
            <span>Administrative Provisioning Policy</span>
          </div>
          <p className="text-[11px] text-[#4B4E54] leading-relaxed">
            Public users cannot self-register as authorities. Accounts are provisioned through a controlled municipal vetting process. Citizens can freely browse issues and submit complaints on the Citizen Portal without login.
          </p>
        </div>

        {/* Demo Fast-Login Strip for Testing & Evaluation */}
        <div className="pt-2 border-t border-[#F0EFEA] space-y-2">
          <span className="text-[11px] font-semibold text-[#7E828B] uppercase tracking-wider block">
            Simulated Authority Accounts (Local Testing):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillDemoCredentials('AUTH-ADMIN-01')}
              className="text-left p-2.5 rounded-xl bg-white border border-[#E6E5DE] hover:border-[#8CA81F] hover:bg-[#F2F8D5]/30 transition-all flex items-center justify-between group"
            >
              <div>
                <span className="font-semibold text-[#191B1D] block">AUTH-ADMIN-01</span>
                <span className="text-[10px] text-[#7E828B]">Municipal Admin</span>
              </div>
              <ArrowRight className="w-3 h-3 text-[#7E828B] group-hover:text-[#191B1D] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => fillDemoCredentials('OFF-MPW-01')}
              className="text-left p-2.5 rounded-xl bg-white border border-[#E6E5DE] hover:border-[#8CA81F] hover:bg-[#F2F8D5]/30 transition-all flex items-center justify-between group"
            >
              <div>
                <span className="font-semibold text-[#191B1D] block">OFF-MPW-01</span>
                <span className="text-[10px] text-[#7E828B]">Public Works Officer</span>
              </div>
              <ArrowRight className="w-3 h-3 text-[#7E828B] group-hover:text-[#191B1D] group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </Card>

      <div className="text-center pt-6">
        <button
          onClick={() => setActiveTab('citizen')}
          className="text-xs text-[#7E828B] hover:text-[#191B1D] underline"
        >
          Return to Citizen Portal (No login required)
        </button>
      </div>
    </div>
  );
}
