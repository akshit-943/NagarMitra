import React, { useState, useMemo } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import CivicMap from '../components/CivicMap';
import { useCivic } from '../context/CivicContext';
import {
  MapPin,
  Layers,
  Filter,
  PlusCircle,
  ExternalLink,
  Flame,
  Sparkles,
} from 'lucide-react';

export default function PublicMapPage() {
  const {
    complaints,
    masterIssues,
    hotspots,
    setIsSubmitModalOpen,
    setSelectedComplaintId,
    setActiveTab,
  } = useCivic();

  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');

  const categories = [
    'All',
    'Roadways & Pavement',
    'Water & Sanitation',
    'Street Lighting & Electrical',
    'Drainage & Flood Control',
    'Waste & Illegal Dumping',
    'Parks & Public Spaces',
  ];

  // Map live markers
  const mapMarkers = useMemo(() => {
    const list = [];
    const isIndia = (lat, lng) => {
      const nLat = Number(lat);
      const nLng = Number(lng);
      return !isNaN(nLat) && !isNaN(nLng) && nLat >= 6.0 && nLat <= 38.5 && nLng >= 68.0 && nLng <= 98.5;
    };

    if (masterIssues && masterIssues.length > 0) {
      masterIssues.forEach((m) => {
        if (activeCategory !== 'All' && m.category !== activeCategory) return;
        if (activeStatus !== 'All' && m.status !== activeStatus) return;

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
            isMaster: true,
          });
        }
      });
    }

    if (complaints && complaints.length > 0) {
      complaints.forEach((c) => {
        if (activeCategory !== 'All' && c.category !== activeCategory) return;
        if (activeStatus !== 'All' && c.status !== activeStatus) return;

        // Skip if this complaint's master issue is already represented in list
        if (c.masterIssueId && list.some((m) => m.id === c.masterIssueId)) return;

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
              isMaster: false,
            });
          }
        }
      });
    }

    return list;
  }, [masterIssues, complaints, activeCategory, activeStatus]);

  return (
    <div className="space-y-6 py-4">
      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F8D5] border border-[#D2E873] text-xs font-medium text-[#3E520A] mb-2">
            <Layers className="w-3.5 h-3.5 text-[#8CA81F]" />
            <span>Interactive Municipal Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#191B1D] tracking-tight">
            Public Civic Infrastructure Map
          </h1>
          <p className="text-xs text-[#7E828B]">
            Explore real-time civic incidents, verified hotspots, and repair clusters across the municipality.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={PlusCircle}
          onClick={() => setIsSubmitModalOpen(true)}
        >
          Report Issue at Your Location
        </Button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#E6E5DE]">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-[#191B1D] text-white'
                : 'bg-[#F0EFEA] text-[#4B4E54] hover:bg-[#E6E5DE] hover:text-[#191B1D]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Full-Height Civic Map Canvas */}
      <Card className="p-0 border border-[#E6E5DE] bg-white rounded-3xl overflow-hidden shadow-sm">
        <div className="h-[620px] w-full relative">
          <CivicMap
            issues={mapMarkers}
            hotspots={hotspots}
            height="100%"
            showResolved={true}
            onSelectIssue={(issue) => {
              const targetId = issue?.complaintId || issue?.id;
              if (targetId) setSelectedComplaintId(targetId);
            }}
          />
        </div>

        {/* Map Footer Bar */}
        <div className="p-4 bg-[#FAF9F5] border-t border-[#E6E5DE] flex flex-wrap items-center justify-between gap-4 text-xs text-[#7E828B]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5484D]" />
              <span>Critical Severity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F76B15]" />
              <span>High / In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8CA81F]" />
              <span>Resolved Field Repairs</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-[#E5484D]" />
              <span>Density Hotspots ({hotspots?.length || 0})</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#4B4E54]">
            Showing {mapMarkers.length} live geocoded coordinate markers
          </div>
        </div>
      </Card>
    </div>
  );
}
