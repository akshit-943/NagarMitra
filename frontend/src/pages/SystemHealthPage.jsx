import React from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import HealthStatus from '../components/HealthStatus';
import TechStackGrid from '../components/TechStackGrid';
import { ShieldCheck, Lock, Database, Sparkles, Layers, Terminal } from 'lucide-react';

export default function SystemHealthPage() {
  return (
    <div className="space-y-8 py-2">
      <div className="pb-3 border-b border-[#E6E5DE]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8CA81F]" />
          <h1 className="font-editorial text-3xl text-[#191B1D]">
            System Foundation &amp; Architecture Audit
          </h1>
        </div>
        <p className="text-xs text-[#7E828B] mt-1">
          Real-time connection verification with Node.js Express server, environment variable isolation, and modular framework status.
        </p>
      </div>

      {/* Backend Live Health Ping */}
      <section>
        <HealthStatus />
      </section>

      {/* Tech Stack Modules */}
      <section className="space-y-4">
        <div>
          <h2 className="font-editorial text-2xl text-[#191B1D]">Configured Stack Modules</h2>
          <p className="text-xs text-[#7E828B]">Verified libraries and active foundation integrations</p>
        </div>
        <TechStackGrid />
      </section>

      {/* Architectural Safeguards */}
      <section className="bg-white border border-[#E6E5DE] rounded-2xl p-6 sm:p-7 space-y-3">
        <h3 className="font-semibold text-sm text-[#191B1D]">Architectural Safeguards Verified</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#4B4E54]">
          <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE]">
            <span className="font-medium text-[#191B1D] block mb-1">Secret Isolation</span>
            <p>MongoDB URI, Gemini API key, Cloudinary credentials, and JWT secret are kept exclusively in backend .env and never bundled into client assets.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE]">
            <span className="font-medium text-[#191B1D] block mb-1">Git Safety Verified</span>
            <p>Both root and subfolder .gitignore rules strictly block .env files while keeping .env.example templates tracked.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE]">
            <span className="font-medium text-[#191B1D] block mb-1">CORS &amp; Middleware</span>
            <p>Express server is configured with credentials support, secure JSON parser, and centralized error handling middleware.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F7F4] border border-[#E6E5DE]">
            <span className="font-medium text-[#191B1D] block mb-1">Design Token Consistency</span>
            <p>Tailwind v4 tokens establish warm off-white canvas (#F7F7F4), charcoal type (#191B1D), soft lime green (#D2E873), and muted pastels.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
