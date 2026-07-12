"use client";

import React, { useState, useEffect } from 'react';
import MasterDock from '@/components/MasterDock';
import BoUDashboard from '@/components/BoUDashboard';
import OperatorDashboard from '@/components/OperatorDashboard';
import CitizenPortal from '@/components/CitizenPortal';
import { 
  ShieldAlert, Send, Plus, Sparkles, AlertCircle, Phone, 
  MapPin, HelpCircle, RefreshCw 
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

// Preset fallbacks matching database initialization if server is starting or offline
const initialComplaintsFallback = (now: Date): Complaint[] => [
  {
    id: 'complaint-uuid-1',
    ticket_reference: 'BOU-2026-004821',
    subscriber_phone: '+256772123456',
    network_provider: 'mtn',
    category: 'sim_swap',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004821.mp3',
    initial_transcript: 'Kussa ssente zange ku simu naye nfunye sms nti sim yange ekyusiddwa mu ma-veelo awatali kussa PIN ye y\'ekyama yange',
    corrected_transcript: 'I deposited money on my phone but I received an SMS that my SIM card was swapped under the table without entering my secret PIN.',
    status: 'escalated',
    district: 'Kampala',
    channel_source: 'app',
    amount_ugx: 450000,
    sla_deadline: new Date(now.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now.getTime() - 45.5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'complaint-uuid-2',
    ticket_reference: 'BOU-2026-004810',
    subscriber_phone: '+256701987654',
    network_provider: 'airtel',
    category: 'voice_scam',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004810.mp3',
    initial_transcript: 'Aba airtel bankubidde essimu nti ntwangudde emmotoka naye bampise kussa PIN ye y\'ekyama yange ne batwala ssente zange zonna ku wallet',
    corrected_transcript: 'Someone from Airtel called saying I won a car, but they coerced me to enter my secret PIN and they took all the money from my wallet.',
    status: 'under_review',
    district: 'Gulu',
    channel_source: 'ivr',
    amount_ugx: 780000,
    sla_deadline: new Date(now.getTime() + 4.2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now.getTime() - 43.8 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'complaint-uuid-3',
    ticket_reference: 'BOU-2026-004819',
    subscriber_phone: '+256777888999',
    network_provider: 'mtn',
    category: 'overcharge',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004819.mp3',
    initial_transcript: 'Nabadde ntuma ssente naye bankubye sente nyingi nnyo ku transaction fee',
    corrected_transcript: 'I was sending money but they charged me too much transaction fees.',
    status: 'resolved',
    district: 'Masaka',
    channel_source: 'ussd',
    amount_ugx: 50000,
    sla_deadline: new Date(now.getTime() + 38 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'complaint-uuid-4',
    ticket_reference: 'BOU-2026-004818',
    subscriber_phone: '+256752555666',
    network_provider: 'airtel',
    category: 'sim_swap',
    raw_audio_url: 'https://storage.googleapis.com/tulinde-complaints/audio-004818.mp3',
    initial_transcript: 'Simu yange evuddeko service ne banyaga ssente zange ku mobile money ku ssimu endala',
    corrected_transcript: 'My SIM card lost service and they stole my money on Mobile Money using another phone.',
    status: 'under_review',
    district: 'Mbarara',
    channel_source: 'sms',
    amount_ugx: 1200000,
    sla_deadline: new Date(now.getTime() + 46.2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now.getTime() - 1.8 * 60 * 60 * 1000).toISOString()
  }
];

export default function Page() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentRole, setCurrentRole] = useState<'bou' | 'mtn' | 'airtel' | 'citizen'>('bou');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [apiConnected, setApiConnected] = useState(false);

  // Authentication State
  const [authSession, setAuthSession] = useState<{ username: string; token: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Webhook Simulator state
  const [simPhone, setSimPhone] = useState('+256772123456');
  const [simProvider, setSimProvider] = useState<'mtn' | 'airtel'>('mtn');
  const [simCategory, setSimCategory] = useState<'sim_swap' | 'voice_scam' | 'overcharge'>('sim_swap');
  const [simSlang, setSimSlang] = useState('Kussa ssente zange ku simu naye nfunye sms nti sim yange ekyusiddwa mu ma-veelo');
  const [simDistrict, setSimDistrict] = useState('Kampala');
  const [simAmount, setSimAmount] = useState('450000');
  const [simChannel, setSimChannel] = useState<'ussd' | 'ivr' | 'sms' | 'app' | 'pwa'>('ivr');
  const [simLoading, setSimLoading] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState<string | null>(null);

  // Resolve active portal/dashboard role dynamically on mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      const hostname = window.location.hostname;
      const envRole = process.env.NEXT_PUBLIC_DASHBOARD_ROLE as 'bou' | 'mtn' | 'airtel' | 'citizen';

      let detectedRole: 'bou' | 'mtn' | 'airtel' | 'citizen' = 'bou';
      if (envRole === 'bou' || envRole === 'mtn' || envRole === 'airtel' || envRole === 'citizen') {
        detectedRole = envRole;
      } else if (port === '3002' || hostname.includes('mtn.')) {
        detectedRole = 'mtn';
      } else if (port === '3003' || hostname.includes('airtel.')) {
        detectedRole = 'airtel';
      } else if (port === '3004' || hostname.includes('citizen.')) {
        detectedRole = 'citizen';
      }
      setCurrentRole(detectedRole);
    }
  }, []);

  // Check storage session on role/mount shift
  useEffect(() => {
    if (isMounted) {
      const stored = localStorage.getItem(`tulinde_session_${currentRole}`);
      if (stored) {
        setAuthSession(JSON.parse(stored));
      } else {
        setAuthSession(null);
      }
      setAuthError(null);
    }
  }, [currentRole, isMounted]);

  // Bind role and theme selectors to html DOM elements (triggers global CSS vars switches)
  useEffect(() => {
    if (!isMounted) return;
    const root = document.documentElement;
    root.setAttribute('data-role', currentRole);
    root.setAttribute('data-theme', theme);
  }, [currentRole, theme, isMounted]);

  const loadData = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/bou/surveillance');
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.complaints);
        setAuditLogs(data.auditLogs);
        setApiConnected(true);
      } else {
        throw new Error('API server returned error code.');
      }
    } catch (err) {
      console.warn('Backend API server offline, loading offline presets fallbacks.');
      setApiConnected(false);
      
      // Setup default mock values in state
      if (complaints.length === 0) {
        setComplaints(initialComplaintsFallback(new Date()));
        setAuditLogs([
          { id: 'log-1', complaint_id: null, action_taken: 'System initialized in offline mode.', operator_identity: 'local_preset', timestamp: new Date().toISOString() }
        ]);
      }
    }
  };

  useEffect(() => {
    loadData();
    // Poll updates every 6 seconds to show dynamic changes
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = (role: 'bou' | 'mtn' | 'airtel' | 'citizen') => {
    if (typeof window !== 'undefined') {
      const port = window.location.port;
      const hostname = window.location.hostname;
      // If we are running on dedicated ports, redirect instead of state switching
      if (port === '3000' || port === '3002' || port === '3003' || port === '3004' || hostname.includes('localhost')) {
        const urls = {
          bou: `${window.location.protocol}//${window.location.hostname}:3000`,
          mtn: `${window.location.protocol}//${window.location.hostname}:3002`,
          airtel: `${window.location.protocol}//${window.location.hostname}:3003`,
          citizen: `${window.location.protocol}//${window.location.hostname}:3004`
        };
        window.location.href = urls[role];
        return;
      }
    }
    setCurrentRole(role);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginEmail,
          password: loginPassword,
          role: currentRole
        })
      });

      if (res.ok) {
        const data = await res.json();
        const session = { username: data.username, token: data.token };
        localStorage.setItem(`tulinde_session_${currentRole}`, JSON.stringify(session));
        setAuthSession(session);
        setLoginEmail('');
        setLoginPassword('');
      } else {
        const errData = await res.json();
        setAuthError(errData.error || 'Authentication failed. Check credentials.');
      }
    } catch (err) {
      setAuthError('Connection to authorization server failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`tulinde_session_${currentRole}`);
    setAuthSession(null);
  };

  const handleThemeToggle = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const triggerIngestWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    setSimSuccessMsg(null);

    const payload = {
      caller_number: simPhone,
      audio_recording_url: `https://storage.googleapis.com/tulinde-complaints/audio-${Math.floor(100000 + Math.random() * 900000)}.mp3`,
      network_provider: simProvider,
      raw_transcript: simSlang,
      category: simCategory,
      district: simDistrict,
      channel_source: simChannel,
      amount_ugx: Number(simAmount) || 0
    };

    try {
      const res = await fetch('http://localhost:3001/api/v1/ingest/complaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSimSuccessMsg(`Successfully ingested! Ref: ${data.complaint.ticket_reference}. AI translated slang.`);
        loadData();
      } else {
        const errorData = await res.json();
        setSimSuccessMsg(`Ingestion Error: ${errorData.error || 'Server rejected request'}`);
      }
    } catch (err) {
      // Local fallback simulation if server is offline
      const mockRef = `BOU-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const now = new Date();
      const mockComplaint: Complaint = {
        id: 'complaint-' + Math.random().toString(36).substring(2, 11),
        ticket_reference: mockRef,
        subscriber_phone: simPhone,
        network_provider: simProvider,
        category: simCategory,
        raw_audio_url: payload.audio_recording_url,
        initial_transcript: simSlang,
        // Simple client-side replacement mock
        corrected_transcript: simSlang
          .replace(/kussa/gi, 'deposit / transfer')
          .replace(/mu ma-veelo/gi, 'under the table')
          .replace(/pin ye y'ekyama/gi, 'secret PIN')
          .replace(/tuma/gi, 'send')
          .replace(/kupika/gi, 'coerce'),
        status: 'under_review',
        district: simDistrict,
        channel_source: simChannel,
        amount_ugx: Number(simAmount) || 0,
        sla_deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        created_at: now.toISOString()
      };
      
      setComplaints(prev => [mockComplaint, ...prev]);
      setSimSuccessMsg(`[Offline Simulation] Ingested successfully! Ref: ${mockRef}`);
    } finally {
      setSimLoading(false);
    }
  };

  const loadSlangPreset = (term: string) => {
    if (term === 'sim_swap') {
      setSimPhone('+256772123456');
      setSimProvider('mtn');
      setSimCategory('sim_swap');
      setSimChannel('ivr');
      setSimSlang("Kussa ssente zange ku simu naye nfunye sms nti sim yange ekyusiddwa mu ma-veelo awatali kussa PIN ye y'ekyama yange");
    } else if (term === 'vishing') {
      setSimPhone('+256701987654');
      setSimProvider('airtel');
      setSimCategory('voice_scam');
      setSimChannel('ivr');
      setSimSlang("Aba airtel bankubidde essimu nti ntwangudde emmotoka naye bampise kussa PIN ye y'ekyama yange ne batwala ssente zange zonna ku wallet");
    } else if (term === 'overcharge') {
      setSimPhone('+256777888999');
      setSimProvider('mtn');
      setSimCategory('overcharge');
      setSimChannel('ussd');
      setSimSlang("Nabadde ntuma ssente naye bankubye sente nyingi nnyo ku transaction fee");
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#800020]"></div>
      </div>
    );
  }

  if (currentRole === 'citizen') {
    return (
      <div className="min-h-screen flex flex-col justify-between">
        <MasterDock 
          currentRole={currentRole} 
          theme={theme} 
          onRoleChange={handleRoleChange} 
          onThemeToggle={handleThemeToggle} 
        />
        <CitizenPortal onRefresh={loadData} />
      </div>
    );
  }

  if (!authSession) {
    const titles = {
      bou: "Bank of Uganda • CPRP Command Center",
      mtn: "CPRP Institution Console • MTN Uganda",
      airtel: "CPRP Institution Console • Airtel Uganda"
    };

    const activeTitle = titles[currentRole] || "Compliance Admin Portal";

    return (
      <div className="min-h-screen flex flex-col justify-between bg-[#0A0A0C]">
        <MasterDock 
          currentRole={currentRole} 
          theme={theme} 
          onRoleChange={handleRoleChange} 
          onThemeToggle={handleThemeToggle} 
          authSession={authSession}
          onLogout={handleLogout}
        />

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#11141E] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
            
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">Security Gateway</h2>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-text-muted mt-1">{activeTitle}</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Authorized Username / Email</label>
                <input 
                  type="email" 
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@domain.co.ug"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Secure Password</label>
                <input 
                  type="password" 
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md ${
                  currentRole === 'mtn' ? 'bg-[#FFCC00] text-black hover:bg-[#FFCC00]/90' :
                  currentRole === 'airtel' ? 'bg-[#E40000] text-white hover:bg-[#E40000]/90' :
                  'bg-[#800020] text-white hover:bg-[#800020]/90'
                }`}
              >
                {authLoading ? 'Authorizing Session...' : 'Establish Session'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-white/5 space-y-2">
              <span className="text-[9px] font-black text-[#D97706] tracking-wider uppercase block">Developer Test Credentials:</span>
              <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 text-[10px] font-mono text-slate-400 space-y-1">
                {currentRole === 'bou' && (
                  <div>
                    <span className="text-white">Email:</span> admin@bou.go.ug<br/>
                    <span className="text-white">Password:</span> bouadmin123
                  </div>
                )}
                {currentRole === 'mtn' && (
                  <div>
                    <span className="text-white">Email:</span> agent@mtn.co.ug<br/>
                    <span className="text-white">Password:</span> mtnagent123
                  </div>
                )}
                {currentRole === 'airtel' && (
                  <div>
                    <span className="text-white">Email:</span> agent@airtel.co.ug<br/>
                    <span className="text-white">Password:</span> airtelagent123
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-[10px] text-text-muted border-t border-card-border bg-[#11141E]">
          Bank of Uganda (BoU) Financial Consumer Protection (CPRP) System • Authenticated Gateway
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between">
      
      {/* 1. Global Switching Dock */}
      <MasterDock 
        currentRole={currentRole} 
        theme={theme} 
        onRoleChange={handleRoleChange} 
        onThemeToggle={handleThemeToggle} 
        authSession={authSession}
        onLogout={handleLogout}
      />

      {/* Connection Indicator Bar */}
      <div className={`px-6 py-1.5 text-right text-[10px] font-bold tracking-wider uppercase border-b transition-colors duration-300 flex items-center justify-end gap-1.5 ${
        apiConnected 
          ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
          : 'bg-amber-500/10 border-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        {apiConnected ? "Core Express Gateway: Connected" : "Core Express Gateway: Offline (Simulated State Active)"}
        <button 
          onClick={loadData} 
          className="ml-2 hover:text-text-main flex items-center gap-0.5"
          title="Refresh Data"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* 2. Main Dashboard Views (Isolated Layout Separation) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 transition-all duration-300">
        
        {currentRole === 'bou' && (
          <BoUDashboard 
            complaints={complaints} 
            auditLogs={auditLogs} 
            onRefresh={loadData} 
          />
        )}

        {currentRole === 'mtn' && (
          <OperatorDashboard 
            operatorName="mtn" 
            complaints={complaints} 
            onRefresh={loadData} 
          />
        )}

        {currentRole === 'airtel' && (
          <OperatorDashboard 
            operatorName="airtel" 
            complaints={complaints} 
            onRefresh={loadData} 
          />
        )}

      </main>

      {/* 3. SIMULATOR PANEL FOR WEBHOOK INGESTION */}
      <section className="bg-card-bg border-t border-card-border py-8 px-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-text-main">Africa's Talking USSD/IVR Ingestion Webhook Simulator</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted font-bold">Load Slang Presets:</span>
              <button 
                onClick={() => loadSlangPreset('sim_swap')}
                className="px-2.5 py-1 rounded bg-progress-bg text-[10px] font-bold text-text-main hover:bg-primary hover:text-white transition"
              >
                SIM Swap
              </button>
              <button 
                onClick={() => loadSlangPreset('vishing')}
                className="px-2.5 py-1 rounded bg-progress-bg text-[10px] font-bold text-text-main hover:bg-primary hover:text-white transition"
              >
                Voice Scam
              </button>
              <button 
                onClick={() => loadSlangPreset('overcharge')}
                className="px-2.5 py-1 rounded bg-progress-bg text-[10px] font-bold text-text-main hover:bg-primary hover:text-white transition"
              >
                Overcharge
              </button>
            </div>
          </div>

          <form onSubmit={triggerIngestWebhook} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-progress-bg/35 p-5 rounded-xl border border-card-border">
            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-text-muted">Caller Phone (Uganda Prefix)</label>
              <input 
                type="text" 
                value={simPhone}
                onChange={(e) => setSimPhone(e.target.value)}
                required
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Provider */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-text-muted">Network Layer</label>
              <select 
                value={simProvider}
                onChange={(e) => setSimProvider(e.target.value as 'mtn' | 'airtel')}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="mtn">MTN Network</option>
                <option value="airtel">Airtel Network</option>
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-text-muted">Complaint Type</label>
              <select 
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value as any)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="sim_swap">SIM Swap Fraud</option>
                <option value="voice_scam">Voice Scam / Vishing</option>
                <option value="overcharge">Mobile Money Overcharging</option>
              </select>
            </div>

            {/* Ingestion Submit */}
            <button 
              type="submit" 
              disabled={simLoading}
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Simulate Webhook Trigger
            </button>

            {/* Slang details */}
            <div className="md:col-span-3 flex flex-col gap-1.5 mt-2">
              <label className="text-[10px] uppercase font-bold text-text-muted">Raw Slang Text (Luganda Hybrid)</label>
              <input 
                type="text" 
                value={simSlang}
                onChange={(e) => setSimSlang(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none"
              />
            </div>

            {/* Location & Amount */}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex flex-col gap-1.5 w-1/2">
                <label className="text-[10px] uppercase font-bold text-text-muted">District</label>
                <select 
                  value={simDistrict}
                  onChange={(e) => setSimDistrict(e.target.value)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none"
                >
                  <option value="Kampala">Kampala</option>
                  <option value="Gulu">Gulu</option>
                  <option value="Masaka">Masaka</option>
                  <option value="Mbarara">Mbarara</option>
                  <option value="Jinja">Jinja</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 w-1/2">
                <label className="text-[10px] uppercase font-bold text-text-muted">Amount UGX</label>
                <input 
                  type="text" 
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-card-border bg-card-bg text-text-main focus:outline-none"
                />
              </div>
            </div>
          </form>

          {simSuccessMsg && (
            <div className="mt-3.5 p-3 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
              <AlertCircle className="w-4 h-4" /> {simSuccessMsg}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-text-muted border-t border-card-border bg-card-bg transition-colors duration-300">
        Bank of Uganda (BoU) Financial Consumer Protection (CPRP) System • Version 1.0.0 (Hackathon Release)
      </footer>

    </div>
  );
}
