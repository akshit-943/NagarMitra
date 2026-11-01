import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useCivic } from '../context/CivicContext';
import { LogIn, ArrowRight, UserCheck, ShieldOff, Sparkles, PlusCircle } from 'lucide-react';

export default function CitizenEntryPage() {
  const { setActiveTab } = useCivic();

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs font-medium text-[#3E520A]">
          <Sparkles className="w-3.5 h-3.5 text-[#8CA81F]" />
          <span>Flexible Citizen Engagement</span>
        </div>
        <h1 className="font-editorial text-3xl sm:text-4xl text-[#191B1D] font-normal tracking-tight">
          How would you like to participate?
        </h1>
        <p className="text-sm text-[#7E828B] leading-relaxed">
          NagarMitra empowers everyone. Access your personalized municipal dashboard or report neighborhood concerns immediately as a guest.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Option A: Existing User / Register */}
        <Card className="flex flex-col justify-between p-8 border border-[#E6E5DE] hover:border-[#191B1D] transition-all bg-white relative overflow-hidden group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D] group-hover:bg-[#191B1D] group-hover:text-white transition-colors">
              <UserCheck className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8CA81F]">
                Option A &bull; Registered Citizen
              </span>
              <h2 className="text-2xl font-semibold text-[#191B1D] tracking-tight">
                Welcome Back
              </h2>
              <p className="text-xs text-[#4B4E54] leading-relaxed">
                Log in to access your personal NagarMitra dashboard, track your complaints, and follow local civic issues.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8CA81F]" />
                <span>Centralized complaint status timelines</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8CA81F]" />
                <span>Follow neighborhood master issues & updates</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8CA81F]" />
                <span>In-app notifications when issues are resolved</span>
              </div>
            </div>
          </div>

          <div className="pt-8 space-y-3">
            <Button
              variant="primary"
              size="lg"
              icon={LogIn}
              className="w-full justify-center shadow-sm"
              onClick={() => setActiveTab('citizen-login')}
            >
              Login to Your Account
            </Button>
            <div className="text-center">
              <span className="text-xs text-[#7E828B]">
                New to NagarMitra?{' '}
                <button
                  onClick={() => setActiveTab('citizen-register')}
                  className="font-medium text-[#191B1D] hover:underline"
                >
                  Create free account
                </button>
              </span>
            </div>
          </div>
        </Card>

        {/* Option B: Continue as Guest */}
        <Card className="flex flex-col justify-between p-8 border border-[#E6E5DE] hover:border-[#191B1D] transition-all bg-[#FAF9F5] relative overflow-hidden group">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EBE9E1] flex items-center justify-center text-[#191B1D] group-hover:bg-[#191B1D] group-hover:text-white transition-colors">
              <ShieldOff className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#7E828B]">
                Option B &bull; Login-Free Access
              </span>
              <h2 className="text-2xl font-semibold text-[#191B1D] tracking-tight">
                Continue Without an Account
              </h2>
              <p className="text-xs text-[#4B4E54] leading-relaxed">
                Report civic problems, explore the public map, and access the Citizen Portal without creating an account.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7E828B]" />
                <span>Zero registration or password required</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7E828B]" />
                <span>Submit incident reports in under 30 seconds</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#7E828B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7E828B]" />
                <span>Secure tracking key provided upon submission</span>
              </div>
            </div>
          </div>

          <div className="pt-8 space-y-3">
            <Button
              variant="outline"
              size="lg"
              icon={ArrowRight}
              className="w-full justify-center bg-white hover:bg-[#F0EFEA]"
              onClick={() => setActiveTab('citizen')}
            >
              Continue as Guest
            </Button>
            <div className="text-center">
              <span className="text-xs text-[#7E828B]">
                You can link guest reports to an account anytime later.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
