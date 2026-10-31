import React from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useCivic } from '../context/CivicContext';
import {
  ShieldCheck,
  Zap,
  Users,
  Compass,
  ArrowRight,
  Lock,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function AboutPage() {
  const { setActiveTab, setIsSubmitModalOpen } = useCivic();

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs font-medium text-[#3E520A]">
          <Sparkles className="w-3.5 h-3.5 text-[#8CA81F]" />
          <span>Municipal Accountability & Architecture</span>
        </div>
        <h1 className="font-editorial text-4xl sm:text-5xl text-[#191B1D] font-normal tracking-tight">
          Intelligent infrastructure for responsive cities.
        </h1>
        <p className="text-base text-[#4B4E54] leading-relaxed">
          CivicPulse AI bridges residents and municipal departments with clarity, transparency, and automated dispatch intelligence.
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-[#191B1D]">
            Automated Triage
          </h3>
          <p className="text-xs text-[#7E828B] leading-relaxed">
            Multimodal AI instantly categorizes complaints, evaluates safety hazards, determines severity, and assigns the correct municipal department.
          </p>
        </Card>

        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-[#191B1D]">
            Inclusive Citizen Access
          </h3>
          <p className="text-xs text-[#7E828B] leading-relaxed">
            No mandatory registration or passwords. Report issues in 30 seconds as a guest, or create an optional citizen account for centralized tracking.
          </p>
        </Card>

        <Card className="p-6 border border-[#E6E5DE] bg-white space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base text-[#191B1D]">
            Dynamic SLA Accountability
          </h3>
          <p className="text-xs text-[#7E828B] leading-relaxed">
            Target resolution deadlines adapt dynamically based on citizen impact, severity, and geographic density to ensure prompt field action.
          </p>
        </Card>
      </div>

      {/* Security & Access Philosophy */}
      <Card className="p-8 border border-[#E6E5DE] bg-[#FAF9F5] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#191B1D] text-white flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#D2E873]" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#191B1D]">
              Strict Role-Based Security Isolation
            </h3>
            <p className="text-xs text-[#7E828B]">Protecting municipal command and citizen privacy</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#4B4E54] leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-semibold text-[#191B1D]">Citizen Portal & Guest Experience</h4>
            <p>
              Citizens explore public issues, view the interactive city map, submit complaints, and track resolutions. All guest reports receive a cryptographic tracking token for private progress checks.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-[#191B1D]">Municipal Command Isolation</h4>
            <p>
              Administrative actions — such as changing official statuses, assigning officers, viewing internal notes, and verifying resolution evidence — are strictly locked behind authorized authority credentials.
            </p>
          </div>
        </div>
      </Card>

      {/* Action CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Button
          variant="primary"
          size="lg"
          onClick={() => setIsSubmitModalOpen(true)}
        >
          Report a Civic Issue
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => setActiveTab('citizen-entry')}
        >
          Citizen Sign In / Guest Portal
        </Button>
      </div>
    </div>
  );
}
