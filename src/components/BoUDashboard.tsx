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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Sidebar: Notification Badges */}
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-text-main">Live Geospatial Alerts</h3>
          </div>
          
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] pr-2">
            {geoMetrics.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-10">Initializing radar link...</div>
            ) : (
              geoMetrics.map((geo) => (
                <div key={geo.district} className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                  geo.hazard_state === 'CRITICAL' ? 'bg-[#EF4444]/10 border-[#EF4444]/30' :
                  geo.hazard_state === 'WARNING' ? 'bg-[#F97316]/10 border-[#F97316]/30' :
                  'bg-[#14B8A6]/10 border-[#14B8A6]/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-main flex items-center gap-1.5">
                      {geo.hazard_state === 'CRITICAL' && (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]"></span>
                        </span>
                      )}
                      {geo.district}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      geo.hazard_state === 'CRITICAL' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                      geo.hazard_state === 'WARNING' ? 'bg-[#F97316]/20 text-[#F97316]' :
                      'bg-[#14B8A6]/20 text-[#14B8A6]'
                    }`}>
                      {geo.hazard_state}
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-xs">
                    <div className="flex flex-col">
                      <span className="text-text-muted text-[10px]">60-Min Vol</span>
                      <span className="font-mono font-bold text-text-main">{geo.current_vol}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-text-muted text-[10px]">Baseline (12h)</span>
                      <span className="font-mono font-bold text-text-main">{geo.baseline_vol}/h</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-text-muted text-[10px]">Surge</span>
                      <span className={`font-mono font-bold ${
                        Number(geo.surge_percent) > 20 ? 'text-[#EF4444]' :
                        Number(geo.surge_percent) > 10 ? 'text-[#F97316]' :
                        'text-[#14B8A6]'
                      }`}>
                        +{geo.surge_percent}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Canvas: Radar Map Canvas */}
        <div className="lg:col-span-2 rounded-2xl border border-card-border bg-[#0A0A0C] relative overflow-hidden flex items-center justify-center min-h-[400px]">
          {/* Conceptual Radar Grid Overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" 
            style={{ backgroundImage: 'radial-gradient(#14B8A6 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <div className="w-[500px] h-[500px] border border-primary rounded-full" />
            <div className="absolute w-[350px] h-[350px] border border-primary rounded-full" />
            <div className="absolute w-[200px] h-[200px] border border-primary rounded-full" />
          </div>
          
          <div className="relative w-full h-full max-w-[600px] max-h-[500px] flex items-center justify-center">
            {geoMetrics.map((geo, idx) => {
              // Abstract mapping logic for visual effect without actual lat/lon paths
              const positions: Record<string, { top: string, left: string }> = {
                'Kampala': { top: '50%', left: '55%' },
                'Wakiso': { top: '45%', left: '50%' },
                'Masaka': { top: '70%', left: '40%' },
                'Mbarara': { top: '80%', left: '20%' },
                'Gulu': { top: '25%', left: '45%' },
                'Jinja': { top: '55%', left: '65%' },
              };
              
              const pos = positions[geo.district] || { 
                top: `${30 + (idx * 15 % 50)}%`, 
                left: `${70 + (idx * 10 % 20)}%` 
              };

              const isCritical = geo.hazard_state === 'CRITICAL';
              const isWarning = geo.hazard_state === 'WARNING';
              
              return (
                <div key={geo.district} className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ top: pos.top, left: pos.left }}
                >
                  <div className="relative flex items-center justify-center">
                    {isCritical && (
                      <>
                        <div className="absolute w-24 h-24 bg-[#EF4444]/10 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                        <div className="absolute w-12 h-12 bg-[#EF4444]/20 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                      </>
                    )}
                    {isWarning && (
                      <div className="absolute w-12 h-12 bg-[#F97316]/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                    )}
                    <div className={`w-4 h-4 rounded-full border-2 border-[#0A0A0C] z-10 ${
                      isCritical ? 'bg-[#EF4444]' :
                      isWarning ? 'bg-[#F97316]' :
                      'bg-[#14B8A6]'
                    }`} />
                  </div>
                  <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#0A0A0C]/80 border ${
                    isCritical ? 'text-[#EF4444] border-[#EF4444]/30' :
                    isWarning ? 'text-[#F97316] border-[#F97316]/30' :
                    'text-[#14B8A6] border-[#14B8A6]/30'
                  }`}>
                    {geo.district}
                  </span>
                </div>
              );
            })}
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
