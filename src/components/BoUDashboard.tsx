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

        {/* Right Canvas: Radar Map Canvas */}
        <div className="w-full lg:w-2/3 relative bg-[#D4F0D4] overflow-hidden flex items-center justify-center h-full min-h-[400px]">
          
          {/* Map Canvas Background - Uganda Silhouette without text */}
          <div className="absolute inset-0 opacity-50 flex items-center justify-center pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-[80%] h-[80%]" fill="#BEE3F8" stroke="#90CDF4" strokeWidth="0.5" strokeLinejoin="round">
               {/* Simplified Uganda Country Outline */}
               <path d="M45,10 C50,12 55,10 60,15 C65,20 70,25 72,30 C75,35 80,45 85,55 C88,60 85,65 80,70 C75,75 70,85 60,90 C50,95 40,90 30,85 C20,80 15,75 10,65 C5,55 10,45 15,35 C20,25 25,20 30,15 C35,10 40,8 45,10 Z" fill="#C6F6D5" stroke="#9AE6B4" strokeWidth="0.8"/>
               {/* Internal Abstract District/Region lines */}
               <path d="M30,15 L40,40 L20,50 L15,35" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               <path d="M40,40 L60,35 L72,30" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               <path d="M60,35 L65,55 L85,55" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               <path d="M40,40 L50,65 L65,55" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               <path d="M20,50 L35,70 L50,65" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               <path d="M35,70 L50,90 L60,90" fill="none" stroke="#9AE6B4" strokeWidth="0.5"/>
               {/* Lake Victoria Simulation */}
               <path d="M65,70 C70,68 75,70 80,70 C85,75 80,85 75,85 C70,85 65,80 65,70 Z" fill="#93C5FD" stroke="none"/>
               {/* Lake Albert Simulation */}
               <path d="M12,40 C15,35 20,40 18,48 C15,55 10,50 12,40 Z" fill="#93C5FD" stroke="none"/>
            </svg>
          </div>
          
          {/* Highlight Single Highest Fraud Concentration */}
          <div className="relative w-full h-full">
            {geoMetrics.length > 0 && (
              (() => {
                // Find highest concentration
                const topGeo = [...geoMetrics].sort((a, b) => b.current_vol - a.current_vol)[0];
                
                const positions: Record<string, { top: string, left: string }> = {
                  'Kampala': { top: '45%', left: '55%' },
                  'Wakiso': { top: '50%', left: '48%' },
                  'Masaka': { top: '75%', left: '35%' },
                  'Mbarara': { top: '85%', left: '25%' },
                  'Gulu': { top: '25%', left: '45%' },
                  'Jinja': { top: '50%', left: '65%' },
                };
                
                const pos = positions[topGeo.district] || { top: '50%', left: '50%' };
                const glowColor = 'rgba(211,84,80,0.6)';

                return (
                  <div className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                    style={{ top: pos.top, left: pos.left }}
                  >
                    <div className="relative flex items-center justify-center">
                      {/* Massive Pulsing Radar Rings */}
                      <div className="absolute w-40 h-40 rounded-full animate-ping" style={{ backgroundColor: glowColor, animationDuration: '2.5s' }} />
                      <div className="absolute w-24 h-24 rounded-full animate-ping" style={{ backgroundColor: glowColor, animationDuration: '1.2s' }} />
                      
                      {/* Big Red Halt Button */}
                      <div className="w-12 h-12 rounded-full border-4 border-white shadow-[0_0_30px_rgba(211,84,80,1)] z-10 flex items-center justify-center bg-[#D35450]">
                         <div className="w-4 h-4 bg-white" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)' }} />
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
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
