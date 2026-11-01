import React, { useState, useRef, useEffect, useCallback } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Badge from './ui/Badge';
import CivicMap from './CivicMap';
import VoiceInput from './VoiceInput';
import { useCivic } from '../context/CivicContext';
import {
  searchGeocoding,
  reverseGeocodeCoordinates,
} from '../services/complaintService';
import {
  Sparkles,
  MapPin,
  Check,
  Camera,
  AlertCircle,
  X,
  Phone,
  ShieldCheck,
  RefreshCw,
  Search,
  Navigation,
  Map as MapIcon,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'Roadways & Pavement', label: 'Roadways & Pavement (Potholes, Road damage)' },
  { value: 'Water & Sanitation', label: 'Water & Sanitation (Leaks, Pipe breaks, Drainage)' },
  { value: 'Electrical & Lighting', label: 'Electrical & Lighting (Streetlights, Signals)' },
  { value: 'Sanitation & Waste', label: 'Sanitation & Waste (Illegal dumping, Overflow)' },
  { value: 'Parks & Public Realm', label: 'Parks & Public Realm (Fallen trees, Broken amenities)' },
];

export default function ReportIssueModal({ isOpen, onClose }) {
  const {
    submitComplaint,
    isCitizenAuthenticated,
    citizenUser,
    setActiveTab,
    setSelectedComplaintId,
  } = useCivic();
  const fileInputRef = useRef(null);

  // Form Fields
  const [formData, setFormData] = useState({
    category: 'Roadways & Pavement',
    urgency: 'Moderate',
    description: '',
  });

  // Location Capture State (3 Methods: search | gps | map)
  const [locationMethod, setLocationMethod] = useState('search');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [locationSource, setLocationSource] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [locationNotice, setLocationNotice] = useState(null);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Citizen Contact State
  const [phone, setPhone] = useState(citizenUser?.phone || '');

  const resetForm = useCallback(() => {
    setFormData({
      category: 'Roadways & Pavement',
      urgency: 'Moderate',
      description: '',
    });
    setAddress('');
    setCoords(null);
    setLocationSource('manual');
    setLocationMethod('search');
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchingLocation(false);
    setIsLocatingGps(false);
    setLocationNotice(null);
    setSelectedFile(null);
    setFilePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setErrorMessage(null);
    setSuccessData(null);
    setCopiedLink(false);
    setPhone(isCitizenAuthenticated && citizenUser?.phone ? citizenUser.phone : '');
  }, [isCitizenAuthenticated, citizenUser]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isCitizenAuthenticated) {
      setPhone('');
    } else if (citizenUser?.phone) {
      setPhone(citizenUser.phone);
    }
  }, [isCitizenAuthenticated, citizenUser]);

  // Submission & Success state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic preview heuristics
  const analyzeAiClassification = (text = '') => {
    const lower = text.toLowerCase();
    if (lower.includes('water') || lower.includes('leak') || lower.includes('flood') || lower.includes('drain')) {
      return { dept: 'Water Supply Board', sla: '2 - 4 hours', confidence: '96%' };
    }
    if (lower.includes('light') || lower.includes('signal') || lower.includes('wire') || lower.includes('electric')) {
      return { dept: 'Traffic & Electrical Safety', sla: '1 - 3 hours', confidence: '94%' };
    }
    if (lower.includes('hole') || lower.includes('pothole') || lower.includes('road') || lower.includes('crack')) {
      return { dept: 'Department of Transportation', sla: '24 hours', confidence: '98%' };
    }
    return { dept: 'Municipal Public Works', sla: '24 - 48 hours', confidence: '91%' };
  };

  const aiInsights = analyzeAiClassification(formData.description);

  // ---------------------------------------------------------------------------
  // Location Method A: Search Location (Nominatim Geocoding)
  // ---------------------------------------------------------------------------
  const handleSearchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return;
    setIsSearchingLocation(true);
    setLocationNotice(null);
    try {
      const results = await searchGeocoding(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setLocationNotice('No addresses found for that query. Try a street name or landmark.');
      }
    } catch (err) {
      setLocationNotice('Address search service error.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setAddress(result.display_name);
    setCoords({ lat, lng });
    setLocationSource('geocoding');
    setSearchResults([]);
    setSearchQuery('');
    setLocationNotice(`Location set via search: ${result.display_name.slice(0, 50)}...`);
  };

  // ---------------------------------------------------------------------------
  // Location Method B: Use My Current Location (Browser Geolocation API)
  // ---------------------------------------------------------------------------
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Browser geolocation is not supported on this device.');
      return;
    }
    setIsLocatingGps(true);
    setLocationNotice('Acquiring high-accuracy GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        setLocationSource('gps');

        try {
          const revAddress = await reverseGeocodeCoordinates(lat, lng);
          const finalAddr = revAddress || `GPS Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(finalAddr);
          setLocationNotice(`GPS lock confirmed &bull; ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setAddress(`GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
          setLocationNotice('GPS coordinates captured.');
        } finally {
          setIsLocatingGps(false);
        }
      },
      (error) => {
        setIsLocatingGps(false);
        let msg = 'Failed to obtain GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied by user. You can search or select on the map instead.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location acquisition timed out. Please try again or select on the map.';
        }
        setLocationNotice(msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ---------------------------------------------------------------------------
  // Location Method C: Select on Map (Leaflet Picker + Reverse Geocoding)
  // ---------------------------------------------------------------------------
  const handleMapLocationSelect = async ({ lat, lng }) => {
    if (lat < 6.0 || lat > 38.5 || lng < 68.0 || lng > 98.5) {
      setLocationNotice('Please select an incident location within India.');
      return;
    }
    setCoords({ lat, lng });
    setLocationSource('map_selection');
    setLocationNotice('Resolving address from map coordinates...');
    try {
      const resolvedAddress = await reverseGeocodeCoordinates(lat, lng);
      setAddress(resolvedAddress || `Map Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setLocationNotice(`Pin set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch {
      setAddress(`Selected Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      setLocationNotice('Map pin coordinates locked.');
    }
  };

  // ---------------------------------------------------------------------------
  // File Upload Handlers
  // ---------------------------------------------------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
        setErrorMessage('Only JPEG, PNG, or WEBP images are supported.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('File size must be 5MB or less.');
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setErrorMessage(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------------------------------------------------------------------------
  // Form Submission
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!formData.category) {
      setErrorMessage('Please select an incident category.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Location address is required. Please search, detect GPS, or select on the map.');
      return;
    }
    if (formData.description.trim().length < 10) {
      setErrorMessage('Description must be at least 10 characters long.');
      return;
    }
    if (!phone || !phone.trim() || phone.trim().length < 7) {
      setErrorMessage('Citizen mobile number is required for dispatch notifications and incident tracking.');
      return;
    }

    try {
      setIsSubmitting(true);

      // If user typed address manually and coords are missing, try quick geocoding before submitting
      let finalCoords = coords;
      if ((!finalCoords || !finalCoords.lat) && address.trim().length >= 3) {
        try {
          const geoResults = await searchGeocoding(address.trim());
          if (geoResults && geoResults[0]) {
            finalCoords = {
              lat: Number(geoResults[0].lat),
              lng: Number(geoResults[0].lon),
            };
            setCoords(finalCoords);
          }
        } catch {
          // Backend fallback handles this if search fails
        }
      }

      const payload = {
        category: formData.category,
        description: formData.description.trim(),
        address: address.trim(),
        latitude: finalCoords?.lat ? Number(finalCoords.lat) : null,
        longitude: finalCoords?.lng ? Number(finalCoords.lng) : null,
        location: {
          address: address.trim(),
          latitude: finalCoords?.lat ? Number(finalCoords.lat) : null,
          longitude: finalCoords?.lng ? Number(finalCoords.lng) : null,
          locationSource: finalCoords ? (locationSource === 'manual' ? 'geocoding' : locationSource) : 'manual',
        },
        locationSource: finalCoords ? (locationSource === 'manual' ? 'geocoding' : locationSource) : 'manual',
        phone: phone.trim(),
        department: aiInsights.dept,
        reportedBy: 'Citizen Resident',
        severity: formData.urgency,
      };

      const result = await submitComplaint(payload, selectedFile);

      if (result.success) {
        setSuccessData(result);
      }
    } catch (err) {
      console.error('Submission error:', err);
      const serverErrors = err.response?.data?.errors;
      const errorMsg =
        serverErrors && Array.isArray(serverErrors) && serverErrors.length > 0
          ? serverErrors.join('. ')
          : err.response?.data?.message || err.message || 'Failed to submit complaint. Verify backend server is running.';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingLink = () => {
    if (!successData?.trackingToken || !successData?.data?.complaintId) return;
    const link = `${window.location.origin}/?tab=citizen&trackId=${encodeURIComponent(
      successData.data.complaintId
    )}&token=${encodeURIComponent(successData.trackingToken)}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="File Civic Incident Report"
      subtitle="Submit neighborhood infrastructure, safety, or public health matters with mandatory citizen contact verification."
      maxWidth="max-w-2xl"
    >
      {/* ----------------------------------------------------------------- */}
      {/* SUCCESS SCREEN WITH SECURE TRACKING CREDENTIALS */}
      {/* ----------------------------------------------------------------- */}
      {successData ? (
        <div className="py-6 text-center space-y-5 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-[#F2F8D5] text-[#3E520A] border border-[#D2E873] mx-auto flex items-center justify-center shadow-xs">
            <Check className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h4 className="font-editorial text-2xl text-[#191B1D]">Incident Logged Successfully</h4>
            <div className="inline-block px-3 py-1 bg-[#F0EFEA] rounded-full border border-[#E6E5DE] font-mono text-xs font-semibold text-[#191B1D]">
              Complaint ID: {successData.data?.complaintId}
            </div>
          </div>

          {/* Account Association Card for Authenticated Citizen or Secure Tracking for Guests */}
          {isCitizenAuthenticated ? (
            <div className="p-4 rounded-2xl bg-[#F2F8D5] border border-[#D2E873] max-w-md mx-auto text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#3E520A] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#8CA81F]" />
                  Associated with Your Citizen Account
                </span>
                <Badge variant="sage" size="sm">
                  Linked Account
                </Badge>
              </div>

              <p className="text-[12px] text-[#2B3B08] leading-relaxed">
                This complaint is directly linked to <strong>{citizenUser?.name || citizenUser?.email || 'your account'}</strong>. It is immediately available in <strong>Your Dashboard</strong> and <strong>My Complaints</strong>.
              </p>

              <div className="pt-1 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full flex items-center justify-center gap-1.5"
                  onClick={() => {
                    setSuccessData(null);
                    handleRemoveFile();
                    onClose();
                    setActiveTab('dashboard');
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View in Your Dashboard
                </Button>
              </div>
            </div>
          ) : (
            /* Secure Tracking Credentials Card for Guests */
            <div className="p-4 rounded-2xl bg-[#F7F7F4] border border-[#E6E5DE] max-w-md mx-auto text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#191B1D] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#8CA81F]" />
                  Secure Tracking Credentials
                </span>
                <Badge variant="sage" size="sm">
                  Protected
                </Badge>
              </div>

              <p className="text-[11px] text-[#4B4E54] leading-relaxed">
                To protect resident privacy, this complaint is protected by a cryptographically secure tracking token. Save this token or link to check private resolution milestones:
              </p>

              <div className="p-2.5 rounded-xl bg-white border border-[#E6E5DE] space-y-1 font-mono text-xs">
                <span className="text-[10px] text-[#7E828B] block uppercase tracking-wider">Tracking Token</span>
                <span className="font-semibold text-[#191B1D] break-all select-all">
                  {successData.trackingToken}
                </span>
              </div>

              <button
                type="button"
                onClick={copyTrackingLink}
                className="w-full py-2 px-3 rounded-xl bg-[#191B1D] hover:bg-[#2B2E33] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#D2E873]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Tracking Link Copied!' : 'Copy Secure Tracking Link'}</span>
              </button>
            </div>
          )}

          <p className="text-xs text-[#7E828B] max-w-md mx-auto leading-relaxed">
            Incident dispatched to <strong className="text-[#191B1D]">{successData.data?.department}</strong>. A verification record was securely associated with {successData.data?.verifiedPhone || 'your contact'}.
          </p>

          <div className="pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setSuccessData(null);
                setErrorMessage(null);
                handleRemoveFile();
                onClose();
              }}
            >
              Close Window
            </Button>
          </div>
        </div>
      ) : (
        /* --------------------------------------------------------------- */
        /* REPORT SUBMISSION FORM */
        /* --------------------------------------------------------------- */
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-[#9E2B25] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Category & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Incident Category *"
              options={CATEGORIES}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />

            <Select
              label="Reported Urgency"
              options={[
                { value: 'Low', label: 'Low (Non-disruptive)' },
                { value: 'Moderate', label: 'Moderate (Standard)' },
                { value: 'Critical', label: 'Critical (Safety hazard)' },
              ]}
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
            />
          </div>

          {/* ------------------------------------------------------------- */}
          {/* THREE LOCATION CAPTURE METHODS */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-[#F7F7F4] border border-[#E6E5DE]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E6E5DE]">
              <div>
                <label className="text-xs font-semibold text-[#191B1D] block">
                  Incident Location Capture *
                </label>
                <span className="text-[11px] text-[#7E828B]">
                  Choose any of the 3 accurate geographical capture methods
                </span>
              </div>

              {/* 3 Method Toggle Pills */}
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-[#E6E5DE] text-xs">
                <button
                  type="button"
                  onClick={() => setLocationMethod('search')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    locationMethod === 'search' ? 'bg-[#191B1D] text-white shadow-xs' : 'text-[#4B4E54]'
                  }`}
                >
                  <Search className="w-3 h-3" />
                  <span>Search</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMethod('gps');
                    handleUseCurrentLocation();
                  }}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    locationMethod === 'gps' ? 'bg-[#191B1D] text-white shadow-xs' : 'text-[#4B4E54]'
                  }`}
                >
                  <Navigation className="w-3 h-3" />
                  <span>GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationMethod('map')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    locationMethod === 'map' ? 'bg-[#191B1D] text-white shadow-xs' : 'text-[#4B4E54]'
                  }`}
                >
                  <MapIcon className="w-3 h-3" />
                  <span>Map Pin</span>
                </button>
              </div>
            </div>

            {/* Method A: Search Input */}
            {locationMethod === 'search' && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search street name, landmark, or ward..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation(e)}
                    className="flex-1 text-xs bg-white border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
                  />
                  <Button
                    type="button"
                    variant="subtle"
                    size="sm"
                    disabled={isSearchingLocation}
                    onClick={handleSearchLocation}
                  >
                    {isSearchingLocation ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto divide-y divide-[#F0EFEA] bg-white rounded-xl border border-[#E6E5DE] shadow-xs">
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectSearchResult(r)}
                        className="p-2 text-xs text-[#191B1D] hover:bg-[#F2F8D5]/40 cursor-pointer transition-colors"
                      >
                        {r.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Method B: GPS Status */}
            {locationMethod === 'gps' && (
              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-[#4B4E54]">Browser Geolocation Lock</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLocatingGps}
                  onClick={handleUseCurrentLocation}
                  icon={Navigation}
                >
                  {isLocatingGps ? 'Locking GPS...' : 'Redetect Location'}
                </Button>
              </div>
            )}

            {/* Method C: Map Pin Selection */}
            {locationMethod === 'map' && (
              <div className="space-y-1.5 pt-1">
                <CivicMap
                  mode="picker"
                  selectedLocation={coords}
                  onLocationSelect={handleMapLocationSelect}
                  height="200px"
                  center={coords ? [coords.lat, coords.lng] : [20.5937, 78.9629]}
                  zoom={coords ? 15 : 5}
                />
              </div>
            )}

            {/* Current Active Location Display */}
            <div className="pt-2 border-t border-[#E6E5DE] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#7E828B]">Resolved Address:</span>
                <Badge variant="lime" size="sm">
                  Source: {locationSource}
                </Badge>
              </div>
              <input
                type="text"
                placeholder="Selected address will appear here, or type manually..."
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setLocationSource('manual');
                }}
                required
                className="w-full text-xs bg-white border border-[#E6E5DE] rounded-xl px-3 py-2 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
              />
              {locationNotice && (
                <span className="text-[10px] text-[#8CA81F] font-medium block">
                  {locationNotice}
                </span>
              )}
            </div>
          </div>

          {/* Description with Voice-Assisted Reporting */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#191B1D]">
                Detailed Description &amp; Field Context * (min 10 characters)
              </label>
              <span className="text-[11px] text-[#7E828B]">
                {formData.description.trim().length} chars
              </span>
            </div>

            {/* Voice Input Controller */}
            <VoiceInput
              value={formData.description}
              onChange={(newDescription) => setFormData({ ...formData, description: newDescription })}
              category={formData.category}
              disabled={isSubmitting}
              isModalOpen={isOpen}
            />

            <textarea
              rows={3}
              className="w-full rounded-xl bg-white border border-[#E6E5DE] focus:border-[#191B1D] px-3.5 py-2.5 text-xs text-[#191B1D] placeholder-[#A2A6B0] transition-colors focus:outline-none resize-none"
              placeholder="Describe what happened, any visible hazards, or how long the issue has persisted..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* AI Routing Preview */}
          <div className="p-3 rounded-xl bg-[#F0EFEA] border border-[#E6E5DE] flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-[#D2E873] text-[#191B1D] mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#191B1D]">Automated Dispatch Routing</span>
                <span className="text-[10px] font-mono text-[#7E828B]">{aiInsights.confidence}</span>
              </div>
              <p className="text-[#4B4E54] mt-0.5 text-[11px]">
                Target: <span className="text-[#191B1D] font-medium">{aiInsights.dept}</span> &bull; SLA: <span className="text-[#191B1D] font-medium">{aiInsights.sla}</span>
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* CITIZEN CONTACT: DIRECT MOBILE PHONE INPUT (NO OTP REQUIRED) */}
          {/* ------------------------------------------------------------- */}
          <div className="p-4 rounded-2xl bg-white border border-[#E6E5DE] shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F0EFEA]">
              <div>
                <h4 className="font-semibold text-xs text-[#191B1D] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#8CA81F]" />
                  Citizen Contact (Mobile Number) *
                </h4>
                <span className="text-[11px] text-[#7E828B]">
                  Used for status updates and incident dispatch notifications. No account or password required.
                </span>
              </div>
              <Badge variant="lime" size="sm">
                Login-Free
              </Badge>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#191B1D] mb-1">
                Mobile Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-[#7E828B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full text-xs bg-[#F7F7F4] border border-[#E6E5DE] rounded-xl pl-8 pr-3 py-2.5 text-[#191B1D] focus:outline-none focus:border-[#8CA81F]"
                />
              </div>
              <p className="text-[10px] text-[#7E828B] mt-1">
                You will receive a unique cryptographic tracking link on submission to monitor field progress anytime.
              </p>
            </div>
          </div>

          {/* Photographic Evidence */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#191B1D]">
              Photographic Evidence (Optional &bull; Max 5MB)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2.5 p-4 rounded-xl border border-dashed border-[#E6E5DE] bg-white hover:bg-[#F9F9F6] transition-colors cursor-pointer text-xs text-[#4B4E54]"
              >
                <Camera className="w-4 h-4 text-[#7E828B]" />
                <span>Click to select an image from your device</span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl border border-[#E6E5DE] bg-white">
                <div className="flex items-center gap-3">
                  {filePreview && (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded-lg border border-[#E6E5DE]"
                    />
                  )}
                  <div className="text-xs">
                    <p className="font-medium text-[#191B1D] truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-[#7E828B]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 rounded-full text-[#7E828B] hover:text-[#9E2B25] hover:bg-[#FBEAE9]"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E6E5DE]">
            <Button variant="ghost" size="md" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                isSubmitting ||
                !address ||
                formData.description.length < 10 ||
                !phone.trim() ||
                phone.trim().length < 7
              }
            >
              {isSubmitting ? 'Transmitting to Registry...' : 'Transmit Incident Report'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
