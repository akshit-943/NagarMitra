import React from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { Layers, Database, MapPin, BarChart3, Lock, Sparkles, Server, Globe } from 'lucide-react';

const technologies = [
  {
    name: 'React 19 + Vite',
    category: 'Frontend Framework',
    icon: Globe,
    status: 'Ready',
    details: 'Vite fast HMR with JSX & ES modules',
    badgeVariant: 'lime',
  },
  {
    name: 'Tailwind CSS v4',
    category: 'Editorial Tokens',
    icon: Layers,
    status: 'Active',
    details: 'Warm off-white, charcoal & soft lime tokens',
    badgeVariant: 'lime',
  },
  {
    name: 'Node.js & Express',
    category: 'Backend Server',
    icon: Server,
    status: 'Running',
    details: 'Modular REST API with /api/health endpoint',
    badgeVariant: 'sage',
  },
  {
    name: 'MongoDB + Mongoose',
    category: 'Database Driver',
    icon: Database,
    status: 'Configured',
    details: 'Mongoose connection helper & schema readiness',
    badgeVariant: 'neutral',
  },
  {
    name: 'Leaflet & React-Leaflet',
    category: 'Geospatial Engine',
    icon: MapPin,
    status: 'Installed',
    details: 'Custom editorial SVG markers & OpenStreetMap tiles',
    badgeVariant: 'blue',
  },
  {
    name: 'Recharts',
    category: 'Data Analytics',
    icon: BarChart3,
    status: 'Installed',
    details: 'Coordinated muted charts for municipal triage',
    badgeVariant: 'lavender',
  },
  {
    name: 'JWT & Security',
    category: 'Authentication',
    icon: Lock,
    status: 'Configured',
    details: 'Token auth middleware & Axios auth interceptors',
    badgeVariant: 'neutral',
  },
  {
    name: 'Cloudinary & Gemini API',
    category: 'Media & Intelligence',
    icon: Sparkles,
    status: 'Placeholders Set',
    details: 'Credentials isolated in backend env (not in client)',
    badgeVariant: 'amber',
  },
];

export default function TechStackGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {technologies.map((tech) => {
        const Icon = tech.icon;
        return (
          <div
            key={tech.name}
            className="p-5 rounded-2xl bg-white border border-[#E6E5DE] transition-all hover:border-[#191B1D]/40 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#F0EFEA] flex items-center justify-center text-[#191B1D]">
                <Icon className="w-4 h-4 text-[#191B1D]" />
              </div>
              <Badge variant={tech.badgeVariant} size="sm">
                {tech.status}
              </Badge>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-[#191B1D]">{tech.name}</h4>
              <p className="text-[11px] text-[#7E828B]">{tech.category}</p>
            </div>
            <p className="text-[11px] text-[#4B4E54] leading-relaxed pt-1 border-t border-[#E6E5DE]">
              {tech.details}
            </p>
          </div>
        );
      })}
    </div>
  );
}
