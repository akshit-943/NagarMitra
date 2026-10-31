import React, { useEffect, useState } from 'react';
import { checkHealth } from '../services/healthService';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { CheckCircle2, AlertCircle, RefreshCw, Server } from 'lucide-react';

export default function HealthStatus() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkHealth();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <Card variant="white" padding="default" className="space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-[#E6E5DE]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F0EFEA] text-[#191B1D]">
            <Server className="w-4 h-4 text-[#3E7295]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[#191B1D]">
              Express Backend Service Status
            </h3>
            <p className="text-xs text-[#7E828B]">
              Monitoring endpoint: <code className="font-mono text-[#191B1D]">/api/health</code>
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
          icon={RefreshCw}
        >
          {loading ? 'Pinging...' : 'Re-verify'}
        </Button>
      </div>

      <div>
        {loading && !healthData && (
          <div className="flex items-center gap-3 text-xs text-[#7E828B] py-3">
            <RefreshCw className="w-4 h-4 animate-spin text-[#8CA81F]" />
            <span>Connecting to backend at http://localhost:5000/api/health...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-[#FBEAE9] border border-[#F5C2BE] text-[#9E2B25] space-y-1">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <AlertCircle className="w-4 h-4 text-[#D93F36]" />
              <span>Backend Unreachable</span>
            </div>
            <p className="text-xs">{error}</p>
            <p className="text-[11px] text-[#9E2B25]/80 mt-1">
              Verify that the Express server is running on port 5000 (`npm run dev` in backend).
            </p>
          </div>
        )}

        {healthData && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#365734] text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#4E704C]" />
              <span>API Server Operational &bull; CORS Origin Confirmed</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F7F7F4] p-3 rounded-xl border border-[#E6E5DE]">
                <span className="block text-[#7E828B] text-[10px] uppercase font-semibold">Status</span>
                <span className="text-[#365734] font-semibold text-sm capitalize">
                  {healthData.status}
                </span>
              </div>
              <div className="bg-[#F7F7F4] p-3 rounded-xl border border-[#E6E5DE]">
                <span className="block text-[#7E828B] text-[10px] uppercase font-semibold">Service</span>
                <span className="text-[#191B1D] font-medium text-xs truncate block">
                  {healthData.service}
                </span>
              </div>
              <div className="bg-[#F7F7F4] p-3 rounded-xl border border-[#E6E5DE]">
                <span className="block text-[#7E828B] text-[10px] uppercase font-semibold">Environment</span>
                <span className="text-[#191B1D] font-medium text-xs uppercase">
                  {healthData.environment}
                </span>
              </div>
              <div className="bg-[#F7F7F4] p-3 rounded-xl border border-[#E6E5DE]">
                <span className="block text-[#7E828B] text-[10px] uppercase font-semibold">Last Checked</span>
                <span className="text-[#191B1D] font-medium text-xs">
                  {lastChecked || 'Just now'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
