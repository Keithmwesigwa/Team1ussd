"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, AlertTriangle, Scale, Award, TrendingUp, CheckCircle, 
  MapPin, Phone, Clock, FileText, Database, ShieldCheck 
} from 'lucide-react';

interface Complaint {
  id: string;
  ticket_reference: string;
  subscriber_phone: string;
  network_provider: 'mtn' | 'airtel';
  category: 'sim_swap' | 'voice_scam' | 'overcharge';
  raw_audio_url: string;
  initial_transcript: string;
  corrected_transcript: string;
  status: 'under_review' | 'resolved' | 'escalated';
  district: string;
  channel_source: 'ussd' | 'ivr' | 'sms' | 'app' | 'pwa';
  amount_ugx: number;
  sla_deadline: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  complaint_id: string | null;
  action_taken: string;
  operator_identity: string;
  timestamp: string;
}

interface GeospatialMetric {
  district: string;
  current_vol: number;
  baseline_vol: string;
  surge_percent: string;
  hazard_state: 'CRITICAL' | 'WARNING' | 'MONITORING';
}

interface BoUDashboardProps {
  complaints: Complaint[];
  auditLogs: AuditLog[];
  onRefresh: () => void;
}

export default function BoUDashboard({ complaints, auditLogs, onRefresh }: BoUDashboardProps) {
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [sanctionStatus, setSanctionStatus] = useState<{ loading: boolean; message: string | null }>({
    loading: false,
    message: null
  });
  const [geoMetrics, setGeoMetrics] = useState<GeospatialMetric[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Set default selected complaint
  useEffect(() => {
    if (complaints.length > 0 && !selectedComplaint) {
      setSelectedComplaint(complaints[0]);
    }
  }, [complaints, selectedComplaint]);

  // Audio Playback Simulation
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setPlaybackTime(prev => {
          if (prev >= 12.0) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return Number((prev + 0.1).toFixed(1));
        });
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSelectComplaint = (comp: Complaint) => {
    setSelectedComplaint(comp);
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  // Run regulatory check & issue sanction Notice
  const triggerRegulatoryEnforcement = async () => {
    setSanctionStatus({ loading: true, message: null });
    try {
      const res = await fetch('http://localhost:3001/api/v1/bou/enforce/sanction', {
        method: 'POST'
      });
      const data = await res.json();
      setSanctionStatus({
        loading: false,
        message: data.sanctionsIssuedCount > 0 
          ? `Notice of Non-Compliance Issued! ${data.sanctionsIssuedCount} operator breach(es) flagged & escalated.`
          : 'SLA Scan completed. All operators currently compliant within 48-Hour timelines.'
      });
      onRefresh();
    } catch (err) {
      setSanctionStatus({
        loading: false,
        message: 'Error connecting to BoU regulatory API engine.'
      });
    }
  };

  // SSE Connection for Live Geospatial Analytics
  useEffect(() => {
    let sseUrl = 'http://localhost:3001/api/v1/analytics/spatial-stream';
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      sseUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/v1/analytics/spatial-stream`;
    }
    const sse = new EventSource(sseUrl);
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setGeoMetrics(data);
      } catch (err) {
        console.error('Failed to parse geospatial metrics', err);
      }
    };
    
    return () => sse.close();
  }, []);

  // Aggregates for layout display
  const totalLoss = complaints.reduce((sum, c) => sum + Number(c.amount_ugx), 0);
  const mtnComplaints = complaints.filter(c => c.network_provider === 'mtn');
  const airtelComplaints = complaints.filter(c => c.network_provider === 'airtel');

  const mtnResolved = mtnComplaints.filter(c => c.status === 'resolved').length;
  const airtelResolved = airtelComplaints.filter(c => c.status === 'resolved').length;

  const mtnCompliance = mtnComplaints.length > 0 ? Math.round((mtnResolved / mtnComplaints.length) * 100) : 100;
  const airtelCompliance = airtelComplaints.length > 0 ? Math.round((airtelResolved / airtelComplaints.length) * 100) : 100;

  // Calculates exact time remaining
  const getTimeRemaining = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return { hours: 0, mins: 0, expired: true };
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours: diffHours, mins: diffMins, expired: false };
  };

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* HEADER: Bank of Uganda Branding Bar */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-[#6B0017]"
        style={{ background: 'linear-gradient(135deg, #800020 0%, #5c0017 60%, #3d000f 100%)' }}>
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left: Logo + Name */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#F5F0E8] border-2 border-[#D4AF6A] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,106,0.4)] overflow-hidden flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bou-logo.png" alt="Bank of Uganda Coat of Arms" className="w-full h-full object-contain p-1" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#F5F0E8] tracking-wide leading-tight">BANK OF UGANDA</h1>
              <p className="text-[11px] font-semibold text-[#D4AF6A] tracking-widest uppercase mt-0.5">Consumer Protection &amp; Fraud Intelligence Hub</p>
            </div>
          </div>

          {/* Center: Decorative divider */}
          <div className="hidden lg:flex items-center gap-3 mx-6">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#D4AF6A]/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF6A]" />
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#D4AF6A]/50" />
          </div>

          {/* Right: Live status + date */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#F5F0E8]/10 border border-[#D4AF6A]/30 rounded-full px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)] animate-pulse" />
              <span className="text-[11px] font-bold text-[#F5F0E8] uppercase tracking-widest">System Online</span>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-[10px] text-[#D4AF6A] font-semibold uppercase tracking-wider">Real-Time</p>
              <p className="text-xs text-[#F5F0E8] font-bold">{new Date().toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Bottom accent strip */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #D4AF6A, #F5F0E8, #D4AF6A)' }} />
      </div>

      {/* SECTION 1: MACRO REGULATORY ANALYTICS GRID */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Metric Card 1: Total Loss */}
        <div className="p-6 rounded-2xl border border-card-border bg-card-bg shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text-muted">Total National Loss</span>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-2xl font-black text-text-main">
            UGX {totalLoss.toLocaleString()}
          </h3>
          <p className="text-xs text-text-muted mt-2">Aggregate swings logged on network layers</p>
        </div>

        {/* Metric Card 2: Compliance Rank */}
        <div className="p-6 rounded-2xl border border-card-border bg-card-bg shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text-muted">MTN SLA Compliance</span>
            <Award className={`w-5 h-5 ${mtnCompliance >= 90 ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <h3 className="text-2xl font-black text-text-main">
            {mtnCompliance}%
          </h3>
          <div className="w-full bg-progress-bg h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-[#FFCC00] h-full rounded-full transition-all duration-500" 
              style={{ width: `${mtnCompliance}%` }} 
            />
          </div>
        </div>

        {/* Metric Card 3: Airtel Compliance */}
        <div className="p-6 rounded-2xl border border-card-border bg-card-bg shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text-muted">Airtel SLA Compliance</span>
            <Award className={`w-5 h-5 ${airtelCompliance >= 90 ? 'text-emerald-500' : 'text-amber-500'}`} />
          </div>
          <h3 className="text-2xl font-black text-text-main">
            {airtelCompliance}%
          </h3>
          <div className="w-full bg-progress-bg h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-[#E40000] h-full rounded-full transition-all duration-500" 
              style={{ width: `${airtelCompliance}%` }} 
            />
          </div>
        </div>

        {/* Metric Card 4: Sandbox Volume */}
        <div className="p-6 rounded-2xl border border-card-border bg-card-bg shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-text-muted">Fintech Sandbox Target</span>
            <Database className="w-5 h-5 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-text-main">
            3.82 / 5.00 B
          </h3>
          <p className="text-xs text-emerald-500 font-semibold mt-2">Active volumes • On Track</p>
        </div>

      </div>

      {/* SECTION 2: THE SLA FUSE MASTER CONTROLLER & COMPLIANCE BOARD */}
      <div className="p-6 rounded-2xl border-2 border-primary/20 bg-card-bg shadow-md flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Scale className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-main">National SLA Enforcement Panel</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Initiates automatic compliance scans to detect tickets exceeding the 48-Hour resolution limit and escalates sanctions.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          <button
            onClick={triggerRegulatoryEnforcement}
            className="w-full md:w-auto px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            Issue Formal Non-Compliance Sanction Notice
          </button>
          
          {sanctionStatus.message && (
            <span className="text-xs font-semibold text-primary animate-fade-in text-right">
              {sanctionStatus.message}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 3: LIVE FRAUD HEATMAP & GEOSPATIAL ANOMALY AGGREGATOR */}
      <div className="flex flex-col lg:flex-row rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-6 bg-white h-[600px]">
        
        {/* Left Sidebar: Notification Badges */}
        <div className="w-full lg:w-1/3 p-8 bg-white flex flex-col gap-6 border-r border-gray-100 z-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3.5 h-3.5 rounded-full bg-[#D35450] shadow-[0_0_10px_rgba(211,84,80,0.4)]" />
              <h3 className="text-[22px] font-black text-[#1F2937] tracking-tight">Live Fraud Heatmap</h3>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed font-medium">
              Real-time identification of Mobile Money scam vectors across Ugandan administrative districts. <span className="font-bold text-[#D35450]">9 priority alerts active</span> in the last 60 minutes.
            </p>
          </div>
          
          <div className="flex flex-col gap-5 overflow-y-auto pr-2 pb-4 flex-1 custom-scrollbar">
            {geoMetrics.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-10 font-medium">Initializing radar link...</div>
            ) : (
              geoMetrics.map((geo) => {
                const isCritical = geo.hazard_state === 'CRITICAL';
                const isWarning = geo.hazard_state === 'WARNING';
                const isMonitoring = geo.hazard_state === 'MONITORING';
                
                let cardBg = 'bg-white';
                let borderColor = 'border-gray-100';
                let titleColor = 'text-gray-700';
                let badgeBg = 'bg-gray-100';
                let badgeText = 'text-gray-600';
                let descColor = 'text-gray-500';
                
                if (isCritical) {
                  cardBg = 'bg-[#FFF9F9]';
                  borderColor = 'border-[#FFEAEA]';
                  titleColor = 'text-[#D35450]';
                  badgeBg = 'bg-[#D35450]';
                  badgeText = 'text-white';
                  descColor = 'text-[#D35450]/80';
                } else if (isWarning) {
                  cardBg = 'bg-[#FFFAF0]';
                  borderColor = 'border-[#FFF0D4]';
                  titleColor = 'text-[#B45309]';
                  badgeBg = 'bg-[#EAB308]';
                  badgeText = 'text-white';
                  descColor = 'text-[#B45309]/80';
                } else if (isMonitoring) {
                  cardBg = 'bg-[#F0FDF4]';
                  borderColor = 'border-[#DCFCE7]';
                  titleColor = 'text-[#15803D]';
                  badgeBg = 'bg-[#16A34A]';
                  badgeText = 'text-white';
                  descColor = 'text-[#15803D]/80';
                }

                return (
                  <div key={geo.district} className={`${cardBg} p-5 rounded-2xl border ${borderColor} shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-3 transition-transform hover:scale-[1.02] cursor-pointer`}>
                    <div className="flex justify-between items-start">
                      <span className={`font-extrabold ${titleColor} text-sm leading-tight tracking-wide uppercase`}>
                        {geo.district}<br/>DISTRICT
                      </span>
                      <span className={`${badgeBg} ${badgeText} text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider`}>
                        {geo.hazard_state}
                      </span>
                    </div>
                    <p className={`text-xs ${descColor} font-semibold leading-relaxed mt-1`}>
                      {isCritical ? `Vector: Phishing / Social Engineering. Escalated by ${geo.surge_percent}% in last 12h.` : 
                       isWarning ? `Vector: SIM Swap Fraud. Clusters identified near central corridors.` :
                       `Vector: Fake Promotion SMS. High detection at transit hubs.`}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Canvas: Uganda Map */}
        <div className="w-full lg:w-2/3 relative overflow-hidden h-full min-h-[400px]" style={{ background: 'linear-gradient(145deg, #1a2a3a 0%, #0d1b2a 100%)' }}>
          
          {/* Subtle grid overlay for professional feel */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'linear-gradient(rgba(96,165,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />

          {/* Uganda SVG Map - Clean, no labels */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 500 560"
              className="w-[85%] h-[85%] drop-shadow-2xl"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Outer glow filter */}
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="haltGlow">
                  <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <radialGradient id="districtGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e3a5f" />
                  <stop offset="100%" stopColor="#0f2540" />
                </radialGradient>
                <radialGradient id="lakeGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e4d8c" />
                  <stop offset="100%" stopColor="#0a2d5e" />
                </radialGradient>
              </defs>

              {/* === UGANDA COUNTRY OUTLINE === */}
              {/* Northern Region */}
              <path d="M120,30 L180,20 L240,25 L290,30 L330,50 L340,80 L320,100 L280,110 L240,105 L200,110 L160,100 L130,80 L110,60 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />
              {/* Gulu District (North) */}
              <path d="M130,30 L200,20 L240,25 L240,65 L200,70 L160,65 L130,50 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />
              {/* Arua/West Nile */}
              <path d="M60,30 L130,30 L130,80 L100,95 L60,85 L40,60 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* Central Region */}
              <path d="M160,100 L200,110 L240,105 L280,110 L300,140 L290,180 L260,210 L230,220 L200,215 L170,210 L150,180 L140,150 L145,120 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />
              {/* Kampala District - highlighted slightly */}
              <path d="M210,145 L245,140 L255,165 L245,185 L215,190 L200,170 L200,150 Z"
                fill="#122b45" stroke="#4a90d9" strokeWidth="1.5" />
              {/* Wakiso */}
              <path d="M170,155 L210,145 L200,170 L200,215 L170,210 L155,185 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />
              {/* Mukono/Jinja */}
              <path d="M255,165 L290,155 L310,180 L295,210 L260,210 L245,185 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* Eastern Region */}
              <path d="M290,110 L360,90 L400,110 L420,150 L410,190 L380,220 L340,230 L300,215 L290,180 L300,140 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />
              {/* Mbale */}
              <path d="M340,100 L390,110 L395,145 L360,155 L325,140 L320,115 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* Western Region */}
              <path d="M110,180 L150,180 L170,210 L165,260 L150,300 L120,320 L85,305 L70,270 L75,230 L95,200 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />
              {/* Mbarara */}
              <path d="M115,260 L155,250 L165,280 L150,310 L115,315 L95,290 L100,265 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />
              {/* Kasese */}
              <path d="M70,210 L110,200 L115,260 L95,275 L65,260 L55,230 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* South/Masaka */}
              <path d="M170,250 L215,240 L245,255 L250,300 L230,340 L195,355 L165,340 L150,310 L155,270 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />
              {/* Masaka */}
              <path d="M175,275 L215,268 L220,305 L200,330 L175,325 L160,300 L165,278 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* South-East / Rakai */}
              <path d="M245,255 L295,250 L315,280 L305,330 L275,355 L240,350 L225,325 L230,290 Z"
                fill="url(#districtGrad)" stroke="#2d6a9f" strokeWidth="1.5" />

              {/* South central near Lake Victoria coast */}
              <path d="M215,340 L255,335 L270,370 L250,400 L220,405 L200,380 L205,355 Z"
                fill="#0f2d4a" stroke="#3b82b6" strokeWidth="1" />

              {/* === LAKE VICTORIA (Southeast) === */}
              <path d="M275,360 C310,345 360,350 390,370 C420,395 425,440 410,470 C390,500 355,515 320,510 C285,505 260,490 250,465 C238,440 245,375 275,360 Z"
                fill="url(#lakeGrad)" stroke="#1e4d8c" strokeWidth="2" opacity="0.9" />

              {/* === LAKE ALBERT (Northwest) === */}
              <path d="M30,120 C25,140 28,175 40,195 C52,215 70,218 80,205 C90,192 88,165 78,145 C68,125 42,108 30,120 Z"
                fill="url(#lakeGrad)" stroke="#1e4d8c" strokeWidth="2" opacity="0.9" />

              {/* === LAKE EDWARD (Southwest) === */}
              <path d="M55,295 C45,310 45,340 58,355 C70,368 88,368 98,355 C108,342 107,315 96,302 C84,289 65,282 55,295 Z"
                fill="url(#lakeGrad)" stroke="#1e4d8c" strokeWidth="2" opacity="0.85" />

              {/* === LAKE KYOGA (Center) === */}
              <path d="M220,110 C240,105 265,115 270,130 C275,148 260,160 240,158 C220,156 205,145 207,130 C209,118 215,112 220,110 Z"
                fill="url(#lakeGrad)" stroke="#1e4d8c" strokeWidth="1.5" opacity="0.8" />

              {/* === FRAUD ALERT MARKERS (from geoMetrics) === */}
              {geoMetrics.length > 0 && (() => {
                const sorted = [...geoMetrics].sort((a, b) => b.current_vol - a.current_vol);
                const topGeo = sorted[0];

                // District center coordinates mapped to the SVG viewBox
                const districtCoords: Record<string, { cx: number, cy: number }> = {
                  'Kampala': { cx: 228, cy: 165 },
                  'Wakiso':  { cx: 185, cy: 180 },
                  'Masaka':  { cx: 190, cy: 300 },
                  'Mbarara': { cx: 130, cy: 290 },
                  'Gulu':    { cx: 185, cy: 45 },
                  'Jinja':   { cx: 280, cy: 185 },
                };

                return sorted.map((geo, idx) => {
                  const coord = districtCoords[geo.district] || { cx: 250, cy: 280 };
                  const isTop = geo.district === topGeo.district;
                  const isCritical = geo.hazard_state === 'CRITICAL';
                  const isWarning = geo.hazard_state === 'WARNING';

                  if (isTop) {
                    // Big red pulsing halt button for the worst district
                    return (
                      <g key={geo.district}>
                        {/* Outermost slow pulse */}
                        <circle cx={coord.cx} cy={coord.cy} r="55" fill="rgba(211,84,80,0.12)">
                          <animate attributeName="r" values="45;70;45" dur="3s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.3;0.05;0.3" dur="3s" repeatCount="indefinite"/>
                        </circle>
                        {/* Middle pulse */}
                        <circle cx={coord.cx} cy={coord.cy} r="35" fill="rgba(211,84,80,0.25)">
                          <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite"/>
                        </circle>
                        {/* Inner pulse */}
                        <circle cx={coord.cx} cy={coord.cy} r="22" fill="rgba(211,84,80,0.5)">
                          <animate attributeName="r" values="18;28;18" dur="1.2s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.2s" repeatCount="indefinite"/>
                        </circle>
                        {/* Core halt button */}
                        <circle cx={coord.cx} cy={coord.cy} r="16" fill="#D35450" filter="url(#haltGlow)" />
                        <circle cx={coord.cx} cy={coord.cy} r="16" fill="none" stroke="white" strokeWidth="2.5" />
                        {/* Octagon stop symbol */}
                        <polygon
                          points={`${coord.cx},${coord.cy - 8} ${coord.cx + 5.5},${coord.cy - 5.5} ${coord.cx + 8},${coord.cy} ${coord.cx + 5.5},${coord.cy + 5.5} ${coord.cx},${coord.cy + 8} ${coord.cx - 5.5},${coord.cy + 5.5} ${coord.cx - 8},${coord.cy} ${coord.cx - 5.5},${coord.cy - 5.5}`}
                          fill="white"
                        />
                      </g>
                    );
                  } else {
                    // Smaller secondary markers for other districts
                    const dotColor = isCritical ? '#D35450' : isWarning ? '#EAB308' : '#22c55e';
                    return (
                      <g key={geo.district}>
                        <circle cx={coord.cx} cy={coord.cy} r="7" fill={dotColor} opacity="0.3">
                          <animate attributeName="r" values="5;10;5" dur="2.5s" repeatCount="indefinite"/>
                          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.5s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx={coord.cx} cy={coord.cy} r="5" fill={dotColor} stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
                      </g>
                    );
                  }
                });
              })()}

              {/* Fallback: if no data, show static halt button on Kampala */}
              {geoMetrics.length === 0 && (
                <g>
                  <circle cx={228} cy={165} r="55" fill="rgba(211,84,80,0.12)">
                    <animate attributeName="r" values="45;70;45" dur="3s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.3;0.05;0.3" dur="3s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={228} cy={165} r="35" fill="rgba(211,84,80,0.25)">
                    <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={228} cy={165} r="18" fill="rgba(211,84,80,0.5)">
                    <animate attributeName="r" values="14;22;14" dur="1.2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={228} cy={165} r="16" fill="#D35450" filter="url(#haltGlow)" />
                  <circle cx={228} cy={165} r="16" fill="none" stroke="white" strokeWidth="2.5" />
                  <polygon points="228,157 233.5,159.5 236,165 233.5,170.5 228,173 222.5,170.5 220,165 222.5,159.5" fill="white" />
                </g>
              )}
            </svg>
          </div>

          {/* Top-right status badge — minimal, professional */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/40 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 z-20">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,1)]">
              <span className="sr-only">live</span>
            </span>
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Live Feed</span>
          </div>
        </div>


      {/* SECTION 4: REAL-TIME NATIONAL SYSTEMIC FRAUD TICKER & AUDIO LEDGER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Ticker Table (Left 2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-text-main">National Systemic Fraud Registry</h3>
              <p className="text-xs text-text-muted mt-0.5">Real-time incoming customer logs on core network routes</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Live Channel Feed</span>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border text-[10px] uppercase font-bold text-text-muted tracking-wider">
                  <th className="py-3 px-2">Ticket Ref</th>
                  <th className="py-3 px-2">District</th>
                  <th className="py-3 px-2">Channel</th>
                  <th className="py-3 px-2">Category</th>
                  <th className="py-3 px-2">Loss (UGX)</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">SLA Rem.</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => {
                  const timeRem = getTimeRemaining(c.sla_deadline);
                  const isCritical = !timeRem.expired && timeRem.hours < 6 && c.status !== 'resolved';

                  return (
                    <tr 
                      key={c.id}
                      onClick={() => handleSelectComplaint(c)}
                      className={`border-b border-card-border/60 text-xs hover:bg-progress-bg cursor-pointer transition-all duration-150 ${
                        selectedComplaint?.id === c.id ? 'bg-progress-bg/80 font-semibold' : ''
                      } ${
                        isCritical ? 'animate-pulse-warning border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <td className="py-3.5 px-2 text-text-main font-mono">{c.ticket_reference}</td>
                      <td className="py-3.5 px-2 text-text-main flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-text-muted" />
                        {c.district}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-progress-bg text-text-main">
                          {c.channel_source}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-text-main capitalize">
                        {c.category.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-2 text-text-main font-bold">
                        {Number(c.amount_ugx).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : c.status === 'escalated'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        {c.status === 'resolved' ? (
                          <span className="text-emerald-500 font-bold flex items-center justify-end gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Ok
                          </span>
                        ) : timeRem.expired ? (
                          <span className="text-red-500 font-bold">BREACH</span>
                        ) : (
                          <span className={`font-mono font-bold ${isCritical ? 'text-primary' : 'text-text-main'}`}>
                            {timeRem.hours}h {timeRem.mins}m
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audio Ledger Panel (Right Column) */}
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm flex flex-col gap-5 justify-between">
          <div className="flex items-center gap-2.5 pb-3 border-b border-card-border">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-text-main">Anonymized Audio Audit</h3>
          </div>

          {selectedComplaint ? (
            <div className="flex flex-col gap-4 flex-1">
              
              {/* Media Waveform Player */}
              <div className="bg-progress-bg p-4 rounded-xl border border-card-border flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {selectedComplaint.subscriber_phone}
                  </span>
                  <span className="font-mono">
                    0:{playbackTime.toFixed(0).padStart(2, '0')} / 0:12
                  </span>
                </div>

                {/* Animated Waveform Visualizer */}
                <div className="h-16 flex items-center justify-between gap-1.5 px-2">
                  {[4, 8, 12, 10, 6, 8, 14, 18, 16, 22, 28, 20, 16, 12, 10, 18, 24, 28, 32, 22, 16, 10, 6, 8, 12, 14, 18, 10, 4].map((h, i) => {
                    // compute random variation if playing
                    const heightValue = isPlaying 
                      ? Math.min(36, Math.max(4, h + Math.sin(playbackTime * 4 + i) * 6))
                      : h;
                    
                    const isActive = (i / 30) <= (playbackTime / 12.0);

                    return (
                      <div 
                        key={i} 
                        className={`w-1 rounded-full transition-all duration-100 ${
                          isActive ? 'bg-primary' : 'bg-text-muted/30'
                        }`}
                        style={{ height: `${heightValue}px` }}
                      />
                    );
                  })}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="p-3 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                </div>
              </div>

              {/* Side-by-Side Transcripts */}
              <div className="flex flex-col gap-3 flex-1 justify-around">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Raw IVR Transcript (Luganda)</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] font-bold text-amber-600 uppercase">Input slang</span>
                  </div>
                  <div className="p-3 rounded-lg bg-progress-bg/40 border border-card-border/50 text-xs italic text-text-muted font-sans">
                    "{selectedComplaint.initial_transcript || 'No audio transcription available.'}"
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Normalized Semantic Transcript</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" /> Corrected
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-text-main font-sans">
                    {selectedComplaint.corrected_transcript || 'Semantic translation processing...'}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-text-muted py-10">
              Select a registry log to view transcription audits.
            </div>
          )}
        </div>

      </div>

      {/* SECTION 5: AUDIT LOG TRAIL */}
      <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm">
        <h3 className="text-base font-bold text-text-main mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Regulatory Enforcement Audit Log
        </h3>
        <div className="max-h-40 overflow-y-auto pr-2 flex flex-col gap-2.5">
          {auditLogs.map((log) => (
            <div key={log.id} className="p-3 rounded-lg bg-progress-bg/40 border border-card-border/60 text-xs flex justify-between items-start gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-text-main">{log.action_taken}</span>
                <span className="text-[10px] text-text-muted">Executor: {log.operator_identity}</span>
              </div>
              <span className="font-mono text-[10px] text-text-muted whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="text-center text-xs text-text-muted py-6">No enforcement logs recorded.</div>
          )}
        </div>
      </div>

    </div>
  );
}
