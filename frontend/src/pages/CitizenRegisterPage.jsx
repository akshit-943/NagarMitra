import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useCivic } from '../context/CivicContext';
import {
  UserPlus,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';

export default function CitizenRegisterPage() {
  const { registerCitizenUser, setActiveTab } = useCivic();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const { name, email, phone, password, confirmPassword } = formData;

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please fill in all required registration fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await registerCitizenUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        confirmPassword,
      });
      // Context will automatically log in and redirect to 'dashboard'
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <Card className="p-8 border border-[#E6E5DE] shadow-sm bg-white">
        <div className="text-center space-y-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#191B1D] text-white flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-5 h-5 text-[#D2E873]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#191B1D] tracking-tight">
            Create Citizen Account
          </h1>
          <p className="text-xs text-[#7E828B]">
            Instant setup &bull; No OTP or email verification needed
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-[#FBEAE9] border border-[#F1B5B2] flex items-start gap-2.5 text-xs text-[#9E2B25]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <div className="mb-6 p-3 rounded-xl bg-[#F2F8D5] border border-[#D2E873] flex items-center gap-2 text-xs text-[#3E520A]">
          <ShieldCheck className="w-4 h-4 text-[#8CA81F] shrink-0" />
          <span>Frictionless access. Your account activates immediately upon submit.</span>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <User className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="jane.doe@example.com"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <Mail className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Mobile Number
            </label>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 9876543210 or 9876543210"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <Phone className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
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

          <div>
            <label className="block text-xs font-medium text-[#4B4E54] mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE] text-sm text-[#191B1D] placeholder-[#A0A4AB] focus:bg-white focus:outline-none focus:border-[#191B1D] transition-colors"
                required
              />
              <Lock className="w-4 h-4 text-[#7E828B] absolute left-3.5 top-3" />
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
              Register & Go to Dashboard
            </Button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-[#E6E5DE] space-y-3 text-center text-xs text-[#7E828B]">
          <div>
            Already registered?{' '}
            <button
              onClick={() => setActiveTab('citizen-login')}
              className="font-medium text-[#191B1D] hover:underline"
            >
              Sign in here
            </button>
          </div>
          <div>
            <button
              onClick={() => setActiveTab('citizen')}
              className="text-[#7E828B] hover:text-[#191B1D] inline-flex items-center gap-1 transition-colors"
            >
              <span>Continue as guest without registering</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
