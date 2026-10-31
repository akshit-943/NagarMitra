import React, { useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import CivicMap from '../components/CivicMap';
import { useCivic } from '../context/CivicContext';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  MapPin,
  TrendingUp,
  Compass,
  ExternalLink,
} from 'lucide-react';
import PublicTransparencyDashboard from './PublicTransparencyDashboard';

export default function LandingPage() {
  const {
    setActiveTab,
    setIsSubmitModalOpen,
    complaints,
    masterIssues,
    hotspots,
    setSelectedComplaintId,
    navigateToMasterIssue,
  } = useCivic();

  // Map live master issues and complaints with real coordinates to map markers
  const heroMapIssues = useMemo(() => {
    const list = [];
    const isIndia = (lat, lng) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      return !isNaN(nLat) && !isNaN(nLng) && nLat >= 6.0 && nLat <= 38.5 && nLng >= 68.0 && nLng <= 98.5;
    };

    if (masterIssues && masterIssues.length > 0) {
      masterIssues.forEach((m) => {
        let coords = null;
        if (m.location?.coordinates && m.location.coordinates.length === 2) {
          coords = [Number(m.location.coordinates[1]), Number(m.location.coordinates[0])];
        } else if (m.location?.latitude && m.location?.longitude) {
          coords = [Number(m.location.latitude), Number(m.location.longitude)];
        }
        if (coords && isIndia(coords[0], coords[1])) {
          const linkedComplaint = complaints?.find((c) => c.masterIssueId === m.masterIssueId);
          list.push({
            id: linkedComplaint ? linkedComplaint.complaintId : m.masterIssueId,
            complaintId: linkedComplaint ? linkedComplaint.complaintId : m.masterIssueId,
            masterIssueId: m.masterIssueId,
            title: m.title || m.category,
            category: m.category,
            location: m.location?.address || 'Municipal Ward',
            coordinates: coords,
            status: m.status,
            urgency: m.priority?.level || 'Medium',
            supportingReportCount: m.supportingReportCount || 1,
            citizenSupportCount: m.citizenSupportCount || 0,
          });
        }
      });
    }

    if (complaints && complaints.length > 0) {
      complaints.forEach((c) => {
        // Skip if this complaint's master issue is already represented in list
        if (c.masterIssueId && list.some((m) => m.id === c.masterIssueId)) {
          return;
        }
        if (c.location?.latitude && c.location?.longitude) {
          const lat = Number(c.location.latitude);
          const lng = Number(c.location.longitude);
          if (isIndia(lat, lng)) {
            list.push({
              id: c.complaintId,
              title: c.category,
              category: c.category,
              location: c.location?.address || 'Community Area',
              coordinates: [lat, lng],
              status: c.status,
              urgency: c.severity || 'Medium',
            });
          }
        }
      });
    }

    return list;
  }, [masterIssues, complaints]);

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8">
      {/* 1. HERO SECTION (Split Editorial Layout) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs font-medium text-[#3E520A]">
            <span className="w-2 h-2 rounded-full bg-[#8CA81F] animate-pulse" />
            Civic Technology Platform &bull; v2.0
          </div>

          <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl text-[#191B1D] font-normal tracking-tight leading-[1.08]">
            Civic infrastructure intelligence for responsive cities.
          </h1>

          <p className="text-base sm:text-lg text-[#4B4E54] max-w-xl font-normal leading-relaxed">
            CivicPulse bridges residents and municipal departments with clarity. Report neighborhood concerns in seconds, track automated dispatch in real time, and monitor verifiable resolution metrics.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsSubmitModalOpen(true)}
              className="shadow-sm font-semibold"
            >
              Report an Issue
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setActiveTab('citizen-entry')}
            >
              Get Started
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setActiveTab('public-map')}
              className="text-[#4B4E54] hover:text-[#191B1D]"
            >
              Explore Public Map &rarr;
            </Button>
          </div>

          <div className="pt-4 flex items-center gap-8 text-xs text-[#7E828B]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8CA81F]" />
              <span>Zero bureaucratic friction</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3E7295]" />
              <span>Automated department routing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7C6EB0]" />
              <span>Public accountability</span>
            </div>
          </div>
        </div>

        {/* Right Hero Visual Card — Real Interactive Geographical Map */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden border border-[#E6E5DE] shadow-md bg-white p-2">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E6E5DE] mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D2E873] border border-[#191B1D]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#191B1D]">
                  Live Civic Incident Map
                </span>
              </div>
              <Badge variant="sage" size="sm" dot>
                {heroMapIssues.length} Geocoded Issues
              </Badge>
            </div>

            <CivicMap
              mode="hero"
              issues={heroMapIssues}
              hotspots={hotspots}
              height="380px"
              showResolved={true}
              onSelectIssue={(issue) => {
                setSelectedComplaintId(issue.complaintId || issue.id);
              }}
            />

            <div className="pt-2.5 px-3 pb-1 flex items-center justify-between text-xs text-[#7E828B]">
              <span className="flex items-center gap-1.5 font-medium text-[#4B4E54]">
                <span className="w-2 h-2 rounded-full bg-[#8CA81F]" />
                OpenStreetMap Real-Time Telemetry &bull; 16 Wards
              </span>
              <button
                onClick={() => setActiveTab('public-map')}
                className="font-medium text-[#191B1D] hover:underline inline-flex items-center gap-1"
              >
                <span>Full Map View</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIVE PUBLIC TRANSPARENCY & CIVIC IMPACT DASHBOARD */}
      <section className="pt-4">
        <PublicTransparencyDashboard />
      </section>

      {/* 3. EDITORIAL FEATURE BREAKDOWNS */}
      <section className="space-y-8 pt-8 border-t border-[#E6E5DE]">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7E828B]">
            System Architecture
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl text-[#191B1D] mt-1.5">
            Designed for municipal speed, built for citizen trust.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="white" padding="default" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
              <Zap className="w-5 h-5 text-[#8CA81F]" />
            </div>
            <h3 className="font-semibold text-base text-[#191B1D]">
              Automated Incident Triage
            </h3>
            <p className="text-xs text-[#4B4E54] leading-relaxed">
              Natural language understanding deciphers incoming resident complaints, flags safety hazards, detects duplicate reports, and estimates response SLAs automatically.
            </p>
          </Card>

          <Card variant="white" padding="default" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
              <Compass className="w-5 h-5 text-[#3E7295]" />
            </div>
            <h3 className="font-semibold text-base text-[#191B1D]">
              Geospatial Hotspot Mapping
            </h3>
            <p className="text-xs text-[#4B4E54] leading-relaxed">
              Spatial cluster detection highlights repetitive infrastructure failures — pinpointing chronically damaged pipes or unlit streets before major outages occur.
            </p>
          </Card>

          <Card variant="white" padding="default" className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
              <ShieldCheck className="w-5 h-5 text-[#7C6EB0]" />
            </div>
            <h3 className="font-semibold text-base text-[#191B1D]">
              Transparent Resolution Loops
            </h3>
            <p className="text-xs text-[#4B4E54] leading-relaxed">
              Residents receive automated notifications when field workers arrive, complete repairs, and upload photo verification — ensuring accountability at every step.
            </p>
          </Card>
        </div>
      </section>

      {/* 4. CALL TO ACTION STRIP */}
      <section className="p-8 sm:p-12 rounded-3xl bg-[#191B1D] text-white flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl text-center sm:text-left">
          <h3 className="font-editorial text-3xl font-normal text-white">
            Take active part in your city's infrastructure.
          </h3>
          <p className="text-xs sm:text-sm text-[#A2A6B0]">
            Help municipal teams pinpoint problems faster. Submit a photo, location, and description in under 30 seconds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setIsSubmitModalOpen(true)}
          >
            File a Report Now
          </Button>
        </div>
      </section>
    </div>
  );
}

