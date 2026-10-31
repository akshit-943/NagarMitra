import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import Badge from './ui/Badge';
import { MapPin, Navigation, ExternalLink, Clock, AlertTriangle } from 'lucide-react';

// Helper to keep map view synchronized when center/zoom/bounds props change
function MapViewController({ center, zoom, bounds, mode, selectedLocation }) {
  const map = useMap();
  useEffect(() => {
    if (mode === 'picker') {
      if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
        map.setView([Number(selectedLocation.lat), Number(selectedLocation.lng)], zoom || 15);
      } else if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
        map.setView(center, zoom || 5);
      }
      return;
    }

    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    } else if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom || 5);
    }
  }, [center, zoom, bounds, mode, selectedLocation, map]);
  return null;
}

// Interactive map event listener for Location Picker mode
function LocationPickerEvents({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      if (onSelectLocation) {
        onSelectLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

// Custom editorial SVG markers
const createCustomMarker = (urgency, status, supportCount = 0) => {
  const isCritical = urgency === 'Critical' || urgency === 'CRITICAL';
  const isResolved = status === 'Resolved';

  const bg = isResolved
    ? '#4E704C' // Sage green
    : isCritical
    ? '#191B1D' // Charcoal
    : '#D2E873'; // Soft lime

  const stroke = isResolved
    ? '#FFFFFF'
    : isCritical
    ? '#D2E873'
    : '#191B1D';

  const dot = isResolved
    ? '#A7D4A4'
    : isCritical
    ? '#FF6B6B'
    : '#191B1D';

  const hasMultiple = supportCount > 1;

  const svgHtml = `
    <div style="
      width: ${hasMultiple ? '32px' : '26px'};
      height: ${hasMultiple ? '32px' : '26px'};
      background: ${bg};
      border: 2px solid ${stroke};
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.18);
      cursor: pointer;
      position: relative;
      transition: transform 0.15s ease;
    ">
      ${
        hasMultiple
          ? `
        <span style="
          font-size: 10px;
          font-weight: 700;
          color: ${isCritical ? '#FFF' : '#191B1D'};
          font-family: monospace;
        ">${supportCount}</span>
      `
          : `
        <div style="
          width: 8px;
          height: 8px;
          background: ${dot};
          border-radius: 9999px;
        "></div>
      `
      }
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-editorial-marker',
    iconSize: hasMultiple ? [32, 32] : [26, 26],
    iconAnchor: hasMultiple ? [16, 16] : [13, 13],
    popupAnchor: [0, -14],
  });
};

// Location picker pin marker icon
const createPickerMarker = () => {
  const pinHtml = `
    <div style="
      width: 32px;
      height: 32px;
      background: #191B1D;
      border: 2px solid #D2E873;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
      cursor: grab;
      position: relative;
    ">
      <div style="width: 10px; height: 10px; background: #D2E873; border-radius: 9999px;"></div>
    </div>
  `;
  return L.divIcon({
    html: pinHtml,
    className: 'picker-editorial-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function CivicMap({
  issues = [],
  hotspots = [],
  showHotspots = true,
  center = [20.5937, 78.9629], // India Center
  zoom = 5, // India Overview Zoom
  height = '420px',
  mode = 'public', // 'public' | 'authority' | 'hero' | 'picker'
  showResolved = true, // Default true so all maps display resolved incidents
  onSelectIssue,
  onMarkerClick, // Alias for onSelectIssue
  selectedLocation = null, // For picker mode: { lat, lng }
  onLocationSelect, // For picker mode: ({ lat, lng }) => ...
  className = '',
}) {
  const handleIssueClick = onSelectIssue || onMarkerClick;
  const pickerIcon = useMemo(() => createPickerMarker(), []);

  const isCoordInIndia = (c) => {
    if (!c || !Array.isArray(c) || c.length < 2) return false;
    const lat = Number(c[0]);
    const lng = Number(c[1]);
    return !isNaN(lat) && !isNaN(lng) && lat >= 6.0 && lat <= 38.5 && lng >= 68.0 && lng <= 98.5;
  };

  // Active map shows issues based on showResolved (defaults to true)
  const activeIssues = useMemo(() => {
    if (showResolved || mode === 'authority') return issues.filter((i) => i.status !== 'Rejected');
    return issues.filter((i) => i.status !== 'Resolved' && i.status !== 'Rejected');
  }, [issues, showResolved, mode]);

  // Valid Indian coordinates from active issues
  const validCoordinates = useMemo(() => {
    return activeIssues
      .filter((i) => isCoordInIndia(i.coordinates))
      .map((i) => [Number(i.coordinates[0]), Number(i.coordinates[1])]);
  }, [activeIssues]);

  const mapBounds = useMemo(() => {
    if (mode === 'picker') return null;
    if (validCoordinates.length > 1) {
      return L.latLngBounds(validCoordinates);
    }
    return null;
  }, [validCoordinates, mode]);

  // Compute map center dynamically from valid coordinates if available
  const effectiveCenter = useMemo(() => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      const p = [Number(selectedLocation.lat), Number(selectedLocation.lng)];
      if (isCoordInIndia(p)) return p;
    }
    if (validCoordinates.length === 1) {
      return validCoordinates[0];
    }
    if (validCoordinates.length > 1) {
      const b = L.latLngBounds(validCoordinates);
      return [b.getCenter().lat, b.getCenter().lng];
    }
    if (center && Array.isArray(center) && center.length === 2 && isCoordInIndia(center)) {
      return center;
    }
    return [20.5937, 78.9629]; // Default to geographical center of India
  }, [center, selectedLocation, validCoordinates]);

  const effectiveZoom = useMemo(() => {
    if (selectedLocation && selectedLocation.lat && selectedLocation.lng) {
      return 15;
    }
    if (validCoordinates.length === 1) {
      return 13;
    }
    if (validCoordinates.length > 1) {
      return 8;
    }
    return zoom || 5;
  }, [zoom, selectedLocation, validCoordinates]);

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border border-[#E6E5DE] relative z-10 shadow-xs ${className}`}
    >
      <MapContainer
        center={effectiveCenter}
        zoom={effectiveZoom}
        scrollWheelZoom={mode === 'picker'}
        style={{ height: '100%', width: '100%' }}
      >
        <MapViewController
          center={effectiveCenter}
          zoom={effectiveZoom}
          bounds={mapBounds}
          mode={mode}
          selectedLocation={selectedLocation}
        />

        {/* Location Picker listener */}
        {mode === 'picker' && <LocationPickerEvents onSelectLocation={onLocationSelect} />}

        {/* Standard OpenStreetMap street tiles showing genuine geographical roads and features */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Picker Mode Draggable / Clicked Pin */}
        {mode === 'picker' && selectedLocation && selectedLocation.lat && selectedLocation.lng && (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={pickerIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onLocationSelect?.({ lat: position.lat, lng: position.lng });
              },
            }}
          >
            <Popup>
              <div className="text-xs p-1 font-medium text-[#191B1D]">
                Selected Incident Location
                <div className="text-[10px] text-[#7E828B] font-mono mt-0.5">
                  {Number(selectedLocation.lat).toFixed(5)}, {Number(selectedLocation.lng).toFixed(5)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Hotspot Geospatial Density Clusters */}
        {showHotspots &&
          mode !== 'picker' &&
          hotspots.map((hs) => {
            if (!hs.coordinates || hs.coordinates.length < 2) return null;
            const isHigh = hs.intensity === 'High';
            return (
              <Circle
                key={hs.hotspotId || `hs-${Math.random()}`}
                center={hs.coordinates}
                radius={hs.radiusMeters || 350}
                pathOptions={{
                  color: isHigh ? '#C0392B' : '#8CA81F',
                  fillColor: isHigh ? '#E74C3C' : '#D2E873',
                  fillOpacity: 0.16,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-xs max-w-[210px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#191B1D]">{hs.zone || 'Civic Hotspot'}</span>
                      <span className="text-[10px] font-mono bg-[#191B1D] text-white px-1.5 py-0.2 rounded">
                        {hs.hotspotId}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#4B4E54]">
                      {hs.complaintCount} reports &bull; {hs.category}
                    </div>
                    <div className="text-[10px] text-[#7E828B] pt-1 border-t border-[#E6E5DE] flex justify-between">
                      <span>Trend: {hs.trend || 'Active'}</span>
                      <span>{hs.intensity || 'Normal'} Density</span>
                    </div>
                  </div>
                </Popup>
              </Circle>
            );
          })}

        {/* Regular Incident Markers */}
        {mode !== 'picker' &&
          activeIssues.map((issue) => {
            if (!isCoordInIndia(issue.coordinates)) {
              return null;
            }

            const totalSupport = (issue.supportingReportCount || 1) + (issue.citizenSupportCount || 0);
            const isAuthority = mode === 'authority';

            return (
              <Marker
                key={issue.id || issue.masterIssueId || issue._id}
                position={issue.coordinates}
                icon={createCustomMarker(issue.urgency || issue.priority?.level, issue.status, totalSupport)}
                eventHandlers={{
                  click: () => handleIssueClick?.(issue),
                }}
              >
                <Popup>
                  <div className="p-1.5 space-y-2 max-w-[240px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-medium text-[#7E828B]">
                        {issue.id || issue.masterIssueId}
                      </span>
                      <Badge
                        size="sm"
                        variant={
                          issue.status === 'Resolved'
                            ? 'sage'
                            : issue.urgency === 'Critical'
                            ? 'charcoal'
                            : 'lime'
                        }
                      >
                        {issue.status}
                      </Badge>
                    </div>

                    <h4 className="font-semibold text-xs text-[#191B1D] leading-snug line-clamp-1">
                      {issue.title || issue.category}
                    </h4>

                    <p className="text-[11px] text-[#4B4E54] line-clamp-2">
                      {issue.location || issue.location?.address}
                    </p>

                    {/* Authority Mode: Display Department and SLA deadline */}
                    {isAuthority && (
                      <div className="p-2 rounded-lg bg-[#F7F7F4] border border-[#E6E5DE] text-[10px] space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[#7E828B]">Department:</span>
                          <span className="font-semibold text-[#191B1D] truncate max-w-[120px]">
                            {issue.assignedDepartment || issue.department || 'Public Works'}
                          </span>
                        </div>
                        {issue.resolutionDeadline && (
                          <div className="flex justify-between">
                            <span className="text-[#7E828B]">SLA Deadline:</span>
                            <span className="font-medium text-[#191B1D]">
                              {new Date(issue.resolutionDeadline).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Community Impact in Public / Hero mode */}
                    {!isAuthority && totalSupport > 1 && (
                      <div className="text-[10px] text-[#3E520A] bg-[#F3F8D8] px-2 py-0.5 rounded font-medium flex items-center justify-between">
                        <span>Community Impact:</span>
                        <span>{totalSupport} affected</span>
                      </div>
                    )}

                    {/* Action link */}
                    <div className="pt-1.5 border-t border-[#E6E5DE] flex items-center justify-between text-[11px]">
                      <span className="text-[10px] text-[#7E828B]">{issue.category}</span>
                      <button
                        onClick={() => handleIssueClick?.(issue)}
                        className="font-medium text-[#191B1D] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Map Legend Overlay */}
      {mode !== 'picker' && (
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-[#E6E5DE] rounded-xl px-3 py-1.5 z-[400] text-xs space-y-1 shadow-sm">
          <div className="flex items-center gap-3 text-[11px] text-[#191B1D]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#191B1D] border border-[#D2E873]" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D2E873] border border-[#191B1D]" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4E704C] border border-white" />
              <span>Resolved</span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State Banner for Map when zero issues and zero hotspots */}
      {mode !== 'picker' && issues.length === 0 && (!hotspots || hotspots.length === 0) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-[#E6E5DE] rounded-full px-4 py-1.5 z-[400] text-xs font-medium text-[#7E828B] shadow-sm flex items-center gap-2 pointer-events-none">
          <MapPin className="w-3.5 h-3.5 text-[#A0A4AB]" />
          <span>No reported civic issues in this area yet.</span>
        </div>
      )}

      {/* Picker Mode Instruction Banner */}
      {mode === 'picker' && (
        <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-sm border border-[#E6E5DE] rounded-xl px-3 py-1.5 z-[400] text-xs text-[#191B1D] flex items-center gap-2 shadow-sm">
          <Navigation className="w-3.5 h-3.5 text-[#8CA81F]" />
          <span>Click anywhere on the map or drag the pin to pinpoint the exact location.</span>
        </div>
      )}
    </div>
  );
}
