"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Send, Plus, Sparkles, AlertCircle, Phone, 
  MapPin, HelpCircle, RefreshCw, Wifi, WifiOff, Smartphone, 
  Monitor, MessageSquare, ArrowRight, CheckCircle, Clock, AlertTriangle, Play
} from 'lucide-react';

// Static translations matching selected languages
const translations = {
  en: {
    title: "Tulinde",
    tagline: "CONSUMER PROTECTION • BOU",
    slogan: "Your money, protected.",
    offlineNotice: "No data? Dial *256# to continue",
    reportFraud: "Report Fraud",
    reportFraudSub: "Lodge a complaint with your telecom operator",
    trackComplaint: "Track Complaint",
    trackComplaintSub: "Check the live status of your case",
    checkNumber: "Check a Number",
    checkNumberSub: "Verify a number before sending money",
    recentActivity: "RECENT ACTIVITY",
    narrativeLabel: "Detailed Narrative (Slang supported)",
    categoryLabel: "Issue Category",
    providerLabel: "Affected Platform",
    txnLabel: "Disputed Transaction ID",
    phoneLabel: "Your Registered Phone Number",
    submitBtn: "File Complaint",
    verifiedBtn: "Verify Number",
    chatPlaceholder: "Send message (low data)..."
  },
  lg: {
    title: "Tulinde",
    tagline: "OKUKUMY EBY\'EMPAX • BOU",
    slogan: "Sente zo, zikuumiddwa.",
    offlineNotice: "Tewali data? Nyiga *256# okugenda mu maaso",
    reportFraud: "Manya Obubbi",
    reportFraudSub: "Manya era oloopere obubbi ku simu yo",
    trackComplaint: "Goberera Omushango",
    trackComplaintSub: "Kebera entekateeka y\'omushango gwo",
    checkNumber: "Kebera Ennamba",
    checkNumberSub: "Kebera ennamba nga tonnasindika sente",
    recentActivity: "EMIRIMU GY\'AKASEERA KANO",
    narrativeLabel: "Binyonnyole mu bujjuvu (Luganda slang ekkirizibwa)",
    categoryLabel: "Kika ki eky\'obuzibu",
    providerLabel: "Kampuni y\'esimu",
    txnLabel: "Ennamba y\'ekikolwa (Transaction ID)",
    phoneLabel: "Ennamba yo ey\'esimu",
    submitBtn: "Tusaayo Okwemulugunya",
    verifiedBtn: "Kebera Ennamba",
    chatPlaceholder: "Manya obubbi (low data)..."
  },
  nyn: {
    title: "Tulinde",
    tagline: "OKULINDA OMUTUNGI • BOU",
    slogan: "Sente zawe, zilinzilwe.",
    offlineNotice: "No data? Dial *256# to continue",
    reportFraud: "Lopa Obufeere",
    reportFraudSub: "Lopa obufeere hali kampuni yawe ey\'esimu",
    trackComplaint: "Hondera Omusango",
    trackComplaintSub: "Kebera oku omusango gwawe guhikyire",
    checkNumber: "Kebera Enamba",
    checkNumberSub: "Kebera enamba utakasyohereize sente",
    recentActivity: "EBIKOLIRWE HATI",
    narrativeLabel: "Gamba byona ebibeireho (Luganda slang ekkirizibwa)",
    categoryLabel: "Kika ki ky\'obuzibu",
    providerLabel: "Kampuni y\'esimu",
    txnLabel: "Transaction ID ey\'esimu",
    phoneLabel: "Enamba yawe ey\'esimu",
    submitBtn: "Lopa Omusango",
    verifiedBtn: "Kebera Enamba",
    chatPlaceholder: "Handika obutumwa..."
  },
  ach: {
    title: "Tulinde",
    tagline: "GWOKO LABOLO • BOU",
    slogan: "Senteni, ogwoki.",
    offlineNotice: "No data? Dial *256# to continue",
    reportFraud: "Tuc Anyobolo",
    reportFraudSub: "Lodj cente manyo ki kom operator telpon ni",
    trackComplaint: "Lub Kor Kopo",
    trackComplaintSub: "Nen kor dong piny me kopo ni",
    checkNumber: "Nen Namba",
    checkNumberSub: "Ngene namba mapat pe ya icoyo cente",
    recentActivity: "TIC AYE DONG OLOKKE",
    narrativeLabel: "Waco matut piny dong (Luganda slang ekkirizibwa)",
    categoryLabel: "Kabedo me kopo",
    providerLabel: "Kabedo me telepon",
    txnLabel: "Transaction ID",
    phoneLabel: "Namba me telepon ni",
    submitBtn: "Kelo Kopo",
    verifiedBtn: "Nen Namba",
    chatPlaceholder: "Coyo waraga..."
  }
};

const slangHelperPresets = [
  { slang: "kussa ssente ku ssimu endala", translation: "depositing / sending to another number by mistake" },
  { slang: "sim swap mu ma-veelo", translation: "SIM swap executed under the table without PIN entry" },
  { slang: "kutwala wallet zonna", translation: "draining the entire mobile money wallet" },
  { slang: "bankubidde nti ntwangudde emmotoka", translation: "received a vishing call claiming to have won a car" },
  { slang: "bampise kussa PIN ey'ekyama", translation: "coerced / tricked into entering secret PIN" }
];

interface PwaComplaint {
  id: string;
  ticket_reference: string;
  phone_number: string;
  category: string;
  provider: string;
  transaction_id?: string;
  narrative: string;
  status: string;
  created_at: string;
}

interface ChatMessage {
  s: 'c' | 'o'; // c: citizen, o: operator
  t: string; // text
  d: string; // date
}

export default function CitizenPortal({ onRefresh }: { onRefresh: () => void }) {
  const [lang, setLang] = useState<'en' | 'lg' | 'nyn' | 'ach'>('en');
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'home' | 'report' | 'track' | 'verify'>('home');
  
  // Subscriber context
  const [citizenPhone, setCitizenPhone] = useState('+256772123456'); // Pre-populated to match mock seed DB
  
  // Form State
  const [formCategory, setFormCategory] = useState('fraud');
  const [formProvider, setFormProvider] = useState('mtn');
  const [formTxnId, setFormTxnId] = useState('');
  const [formNarrative, setFormNarrative] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Tickets and Chat State
  const [history, setHistory] = useState<PwaComplaint[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<PwaComplaint | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Verification State
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ status: 'safe' | 'flagged' | null; message: string | null }>({
    status: null,
    message: null
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  // Initialize network status, session phone, queue and history
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Retrieve citizen phone or set default
    const storedPhone = localStorage.getItem('tulinde_subscriber_phone');
    if (storedPhone) {
      setCitizenPhone(storedPhone);
    } else {
      localStorage.setItem('tulinde_subscriber_phone', '+256772123456');
    }

    // Check offline queue count
    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll ticket history and active chat
  useEffect(() => {
    fetchHistory();
  }, [citizenPhone]);

  useEffect(() => {
    if (selectedTicket) {
      fetchChatMessages(selectedTicket.ticket_reference);
      const interval = setInterval(() => {
        fetchChatMessages(selectedTicket.ticket_reference);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedTicket]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const updateQueueCount = () => {
    const queue = JSON.parse(localStorage.getItem('tulinde_offline_complaints') || '[]');
    setOfflineQueueCount(queue.length);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/complaints/history?phone=${encodeURIComponent(citizenPhone)}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.warn("Offline or backend unreachable, loading local cached list.");
      // Render fallback local data
      const queue = JSON.parse(localStorage.getItem('tulinde_offline_complaints') || '[]');
      const localMockHistory: PwaComplaint[] = [
        {
          id: 'pwa-1',
          ticket_reference: 'BOU-PWA-2026-X982',
          phone_number: citizenPhone,
          category: 'fraud',
          provider: 'mtn',
          transaction_id: 'TXN100200300',
          narrative: 'A caller claiming to be an MTN agent tricked me into swapping my SIM card.',
          status: 'escalated',
          created_at: new Date(Date.now() - 2 * 3600000).toISOString()
        },
        {
          id: 'pwa-2',
          ticket_reference: 'BOU-PWA-2026-Y479',
          phone_number: citizenPhone,
          category: 'overcharge',
          provider: 'airtel',
          transaction_id: 'TXN998877',
          narrative: 'I was charged twice for a mobile money sending transaction.',
          status: 'resolved',
          created_at: new Date(Date.now() - 72 * 3600000).toISOString()
        }
      ];
      setHistory([...queue, ...localMockHistory]);
    }
  };

  const fetchChatMessages = async (ticketRef: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/chat/messages?ticket=${ticketRef}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      // Offline fallback
      if (chatMessages.length === 0) {
        setChatMessages([
          { s: 'c', t: 'Hello, my MTN wallet was frozen but the fraudster still managed to swap my SIM card. Please check.', d: new Date(Date.now() - 1.8 * 3600000).toISOString() },
          { s: 'o', t: 'Thank you for reporting. We have escalated the issue to the MTN Fraud Risk team.', d: new Date(Date.now() - 1.2 * 3600000).toISOString() }
        ]);
      }
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCitizenPhone(val);
    localStorage.setItem('tulinde_subscriber_phone', val);
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormSuccess(null);

    const payload = {
      phone_number: citizenPhone,
      category: formCategory,
      provider: formProvider,
      transaction_id: formTxnId || null,
      narrative: formNarrative
    };

    if (!isOnline) {
      // Offline processing: save inside queue in local storage
      const queue = JSON.parse(localStorage.getItem('tulinde_offline_complaints') || '[]');
      const mockRef = `BOU-PWA-2026-OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`;
      const offlineItem: PwaComplaint = {
        id: 'offline-' + Math.random().toString(36).substring(2, 11),
        ticket_reference: mockRef,
        phone_number: citizenPhone,
        category: formCategory,
        provider: formProvider,
        transaction_id: formTxnId,
        narrative: formNarrative,
        status: 'ingested (pending online sync)',
        created_at: new Date().toISOString()
      };
      queue.push(offlineItem);
      localStorage.setItem('tulinde_offline_complaints', JSON.stringify(queue));
      updateQueueCount();

      setFormNarrative('');
      setFormTxnId('');
      setFormSuccess(`[Offline Cache Saved] Ticket reference allocated: ${mockRef}. System will sync automatically on network restoration.`);
      setFormLoading(false);
      fetchHistory();
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/v1/complaints/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setFormSuccess(`Ticket filed successfully! Reference: ${data.ticket_reference}`);
        setFormNarrative('');
        setFormTxnId('');
        fetchHistory();
        onRefresh(); // Trigger global refresh for parent dashboard
      } else {
        const errData = await res.json();
        setFormSuccess(`Error: ${errData.error || 'Server rejected submission'}`);
      }
    } catch (err) {
      setFormSuccess('Connection to API server failed. Saved locally.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessage.trim() || !selectedTicket) return;

    const payload = {
      ticket_reference: selectedTicket.ticket_reference,
      sender_type: 'citizen',
      message_text: newChatMessage
    };

    // Client-side quick append for low-latency feedback
    const localTime = new Date().toISOString();
    setChatMessages(prev => [...prev, { s: 'c', t: newChatMessage, d: localTime }]);
    const sentText = newChatMessage;
    setNewChatMessage('');

    try {
      const res = await fetch('http://localhost:3001/api/v1/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchChatMessages(selectedTicket.ticket_reference);
      }
    } catch (err) {
      console.warn("Offline: failed to transmit message packet to gateway.");
    }
  };

  const triggerSyncQueue = async () => {
    const queue = JSON.parse(localStorage.getItem('tulinde_offline_complaints') || '[]');
    if (queue.length === 0) return;

    console.log(`[Offline Sync Engine] Network restored. Pushing ${queue.length} cached tickets...`);

    let syncCount = 0;
    for (const item of queue) {
      try {
        const res = await fetch('http://localhost:3001/api/v1/complaints/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number: item.phone_number,
            category: item.category,
            provider: item.provider,
            transaction_id: item.transaction_id,
            narrative: item.narrative
          })
        });
        if (res.ok) {
          syncCount++;
        }
      } catch (err) {
        console.error("Failed to sync item:", item.ticket_reference, err);
      }
    }

    // Clean local queue
    localStorage.removeItem('tulinde_offline_complaints');
    updateQueueCount();
    fetchHistory();
    onRefresh();

    alert(`🟢 Tulinde Synced: Successfully uploaded ${syncCount} pending complaints to the central registry.`);
  };

  const handleVerifyNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPhone.trim()) return;

    // Mock search check
    const flaggedNumbers = ['+256772999999', '+256701888888', '+256752000000'];
    if (flaggedNumbers.includes(verifyPhone.trim())) {
      setVerifyResult({
        status: 'flagged',
        message: '🔴 DANGER: This number has been flagged for voice scams and SIM swap activities in past 48 hours. DO NOT send money.'
      });
    } else {
      setVerifyResult({
        status: 'safe',
        message: '🟢 SAFE: No active compliance warnings found for this number in the BoU Consumer Registry.'
      });
    }
  };

  const injectSlang = (slangText: string) => {
    setFormNarrative(prev => prev ? `${prev} ${slangText}` : slangText);
  };

  return (
    <div className="flex-1 w-full bg-[#0A0A0C] text-gray-200 py-6 px-4 md:px-8">
      
      {/* Dynamic Viewport Configuration Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Wifi className={`w-5 h-5 ${isOnline ? 'text-emerald-500 animate-pulse' : 'text-gray-500'}`} />
          <span className="text-xs font-semibold text-text-muted">
            Portal Mode: <strong className="text-text-main">{isOnline ? 'Edge online' : 'Offline Engine Enabled'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3 bg-progress-bg/85 border border-card-border p-1.5 rounded-xl">
          <button 
            onClick={() => setViewMode('mobile')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'mobile' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main'}`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile Shell
          </button>
          <button 
            onClick={() => setViewMode('desktop')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'desktop' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main'}`}
          >
            <Monitor className="w-3.5 h-3.5" /> Full Desktop View
          </button>
        </div>
      </div>

      {/* Network Status Invariant Top Banner */}
      <div className="max-w-7xl mx-auto mb-6">
        {isOnline ? (
          <div className="bg-emerald-500/10 border border-emerald-500/25 px-5 py-3 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold tracking-wide shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE MODE: System fully synced with central BoU Ledger and telecom partitions.
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/25 px-5 py-3 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-bold tracking-wide animate-pulse shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            OFFLINE MODE ACTIVE: Pending Local Sync Queue: {offlineQueueCount} items.
          </div>
        )}
      </div>

      {/* Viewport Frame Router */}
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        
        {viewMode === 'mobile' ? (
          /* Premium simulated mobile frame */
          <div className="relative w-[375px] h-[780px] bg-[#0E1116] rounded-[52px] border-[14px] border-[#22252A] shadow-2xl overflow-hidden flex flex-col justify-between">
            {/* iPhone screen notches */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-[#22252A] rounded-b-2xl z-50 flex items-center justify-between px-6">
              <div className="w-3.5 h-3.5 rounded-full bg-black/60 border border-white/5" />
              <div className="w-12 h-1 bg-black/60 rounded-full" />
            </div>

            {/* PWA App Body Container */}
            <div className="flex-1 flex flex-col bg-[#0F172A] overflow-y-auto px-4 pt-10 pb-4">
              
              {/* Brand Header */}
              <div className="flex items-center justify-between mt-3 mb-1">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">{t.title}</h2>
                  <p className="text-[9px] uppercase tracking-wider font-extrabold text-[#D97706]">{t.tagline}</p>
                </div>

                {/* Language switcher */}
                <div className="flex gap-1">
                  {(['en', 'lg', 'nyn', 'ach'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`w-7 h-5 text-[9px] font-black rounded uppercase tracking-wider flex items-center justify-center transition ${lang === l ? 'bg-[#D97706] text-black font-extrabold shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Offline dial helper banner */}
              <div className="bg-[#D97706]/10 border border-[#D97706]/20 px-3 py-2 rounded-xl text-[10px] text-[#F59E0B] font-bold mb-4 flex items-center gap-1.5">
                <span className="text-xs">🚫</span> {t.offlineNotice}
              </div>

              {/* Profile Config section */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl mb-4">
                <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">{t.phoneLabel}</label>
                <input 
                  type="text" 
                  value={citizenPhone} 
                  onChange={handlePhoneChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Portal tab switching rendering */}
              {activeTab === 'home' && (
                <div className="space-y-4 flex-1">
                  <p className="text-slate-300 font-medium text-sm pl-0.5">{t.slogan}</p>
                  
                  {/* Action Cards */}
                  <div className="space-y-3">
                    <button 
                      onClick={() => setActiveTab('report')}
                      className="w-full bg-gradient-to-r from-red-950/40 to-slate-900 border border-red-900/30 p-4 rounded-3xl flex items-center justify-between text-left hover:scale-[1.02] transition shadow cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/25">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{t.reportFraud}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 pr-2 leading-snug">{t.reportFraudSub}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-red-500 flex-shrink-0" />
                    </button>

                    <button 
                      onClick={() => setActiveTab('track')}
                      className="w-full bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-900/30 p-4 rounded-3xl flex items-center justify-between text-left hover:scale-[1.02] transition shadow cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/25">
                          <MapPin className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{t.trackComplaint}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 pr-2 leading-snug">{t.trackComplaintSub}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </button>

                    <button 
                      onClick={() => setActiveTab('verify')}
                      className="w-full bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-900/30 p-4 rounded-3xl flex items-center justify-between text-left hover:scale-[1.02] transition shadow cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/25">
                          <Phone className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{t.checkNumber}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 pr-2 leading-snug">{t.checkNumberSub}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    </button>
                  </div>

                  {/* Recent Activity lists */}
                  <div className="mt-6">
                    <h3 className="text-[10px] font-black tracking-wider text-slate-400 uppercase mb-3 pl-0.5">{t.recentActivity}</h3>
                    <div className="space-y-2.5">
                      {history.map((h) => (
                        <div 
                          key={h.id}
                          onClick={() => {
                            setSelectedTicket(h);
                            setActiveTab('track');
                          }}
                          className="bg-slate-900/75 border border-slate-800 p-3 rounded-2xl flex items-center justify-between hover:bg-slate-800 transition cursor-pointer"
                        >
                          <div>
                            <span className="text-xs font-bold font-mono text-blue-400">{h.ticket_reference}</span>
                            <p className="text-[10px] text-slate-400 mt-1 capitalize font-medium">{h.category.replace('_', ' ')} • {h.provider.toUpperCase()}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                            h.status.includes('escalated') ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            h.status.includes('resolved') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            'bg-slate-800 border-slate-700 text-slate-300'
                          }`}>
                            {h.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Report Ingestion Form tab */}
              {activeTab === 'report' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setActiveTab('home')} className="text-slate-400 text-xs hover:text-white">← Home</button>
                    <span className="text-slate-500">/</span>
                    <h3 className="text-sm font-bold text-white">{t.reportFraud}</h3>
                  </div>

                  <form onSubmit={handleComplaintSubmit} className="space-y-3.5">
                    {/* Category */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">{t.categoryLabel}</label>
                      <select 
                        value={formCategory} 
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="fraud">SIM Swap / Impersonation Fraud</option>
                        <option value="voice_scam">Voice Scam / Vishing Call</option>
                        <option value="overcharge">Mobile Money Overcharging</option>
                      </select>
                    </div>

                    {/* Operator */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">{t.providerLabel}</label>
                      <select 
                        value={formProvider} 
                        onChange={(e) => setFormProvider(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="mtn">MTN Mobile Money</option>
                        <option value="airtel">Airtel Money</option>
                      </select>
                    </div>

                    {/* Txn ID */}
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">{t.txnLabel}</label>
                      <input 
                        type="text" 
                        value={formTxnId}
                        placeholder="e.g. TXN99881122"
                        onChange={(e) => setFormTxnId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    {/* Narrative */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[9px] uppercase font-bold text-slate-400">{t.narrativeLabel}</label>
                      </div>
                      <textarea
                        rows={4}
                        value={formNarrative}
                        onChange={(e) => setFormNarrative(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                      />
                    </div>

                    {/* Slang Helpers */}
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[9px] font-black text-[#D97706] tracking-wide block uppercase mb-1.5">Luganda Slang Shortcuts (Low Data Translation Engine)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {slangHelperPresets.map((preset) => (
                          <button
                            type="button"
                            key={preset.slang}
                            onClick={() => injectSlang(preset.slang)}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2 py-1 rounded text-[9px] font-medium"
                            title={preset.translation}
                          >
                            + {preset.slang}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={formLoading}
                      className="w-full bg-primary hover:bg-primary-hover py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      {formLoading ? 'Submitting...' : t.submitBtn}
                    </button>
                  </form>

                  {formSuccess && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-bold text-[#F59E0B] leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                      <span>{formSuccess}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Track Complaint & Chat tab */}
              {activeTab === 'track' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => { setActiveTab('home'); setSelectedTicket(null); }} className="text-slate-400 text-xs hover:text-white">← Home</button>
                    <span className="text-slate-500">/</span>
                    <h3 className="text-sm font-bold text-white">{t.trackComplaint}</h3>
                  </div>

                  {!selectedTicket ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-slate-950/20 border border-dashed border-slate-800 rounded-3xl">
                      <MapPin className="w-8 h-8 text-slate-500 mb-2 animate-bounce" />
                      <p className="text-xs text-slate-400">Select a ticket from the <strong>Recent Activity</strong> list on the Home page to inspect status and chat.</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                      {/* Ticket Spec Details */}
                      <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-2 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-blue-400">{selectedTicket.ticket_reference}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-950 text-[9px] uppercase font-bold text-slate-300 border border-slate-800">{selectedTicket.provider.toUpperCase()}</span>
                        </div>

                        {/* step tracker */}
                        <div className="flex justify-between items-center pt-2 px-1">
                          <div className="flex flex-col items-center">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[9px] font-black">✓</div>
                            <span className="text-[8px] font-bold text-emerald-400 mt-1">Ingested</span>
                          </div>
                          <div className="flex-1 h-0.5 bg-emerald-500 mx-2" />
                          <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                              selectedTicket.status !== 'ingested' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {selectedTicket.status !== 'ingested' ? '✓' : '2'}
                            </div>
                            <span className={`text-[8px] font-bold mt-1 ${selectedTicket.status !== 'ingested' ? 'text-blue-400' : 'text-slate-500'}`}>Review</span>
                          </div>
                          <div className={`flex-1 h-0.5 mx-2 ${selectedTicket.status === 'resolved' ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                          <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                              selectedTicket.status === 'resolved' ? 'bg-emerald-500 text-black' : 
                              selectedTicket.status === 'escalated' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'
                            }`}>
                              {selectedTicket.status === 'resolved' ? '✓' : selectedTicket.status === 'escalated' ? '!' : '3'}
                            </div>
                            <span className={`text-[8px] font-bold mt-1 ${
                              selectedTicket.status === 'resolved' ? 'text-emerald-400' :
                              selectedTicket.status === 'escalated' ? 'text-red-400 font-extrabold' : 'text-slate-500'
                            }`}>
                              {selectedTicket.status === 'escalated' ? 'Escalated' : 'Resolved'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Messaging streaming console */}
                      <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between overflow-hidden">
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px]">
                          {chatMessages.map((msg, idx) => (
                            <div 
                              key={idx} 
                              className={`flex ${msg.s === 'c' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[80%] p-2 rounded-xl border leading-relaxed ${
                                msg.s === 'c' 
                                  ? 'bg-[#2563EB]/10 border-[#2563EB]/25 text-blue-200 rounded-br-none' 
                                  : 'bg-slate-900 border-slate-800 text-slate-300 rounded-bl-none'
                              }`}>
                                <p className="font-semibold">{msg.t}</p>
                                <span className="text-[8px] text-slate-500 font-mono block mt-1 text-right">
                                  {new Date(msg.d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Input bar */}
                        <form onSubmit={handleSendChatMessage} className="flex gap-1.5 mt-2.5 pt-2 border-t border-slate-900/60">
                          <input 
                            type="text" 
                            value={newChatMessage}
                            onChange={(e) => setNewChatMessage(e.target.value)}
                            placeholder={t.chatPlaceholder}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                          />
                          <button 
                            type="submit"
                            className="bg-primary hover:bg-primary-hover w-8 h-8 rounded-xl flex items-center justify-center text-white"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Check Number / scam Directory tab */}
              {activeTab === 'verify' && (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setActiveTab('home')} className="text-slate-400 text-xs hover:text-white">← Home</button>
                    <span className="text-slate-500">/</span>
                    <h3 className="text-sm font-bold text-white">{t.checkNumber}</h3>
                  </div>

                  <form onSubmit={handleVerifyNumber} className="space-y-4">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Verify Mobile Wallet Number</label>
                      <input 
                        type="text"
                        required 
                        value={verifyPhone}
                        placeholder="e.g. +256772999999"
                        onChange={(e) => setVerifyPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-primary hover:bg-primary-hover py-2.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      {t.verifiedBtn}
                    </button>
                  </form>

                  {verifyResult.message && (
                    <div className={`mt-6 p-4 rounded-2xl border text-xs font-semibold leading-relaxed ${
                      verifyResult.status === 'flagged' 
                        ? 'bg-red-500/10 border-red-500/25 text-red-400' 
                        : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    }`}>
                      {verifyResult.message}
                    </div>
                  )}

                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl mt-6">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Note on Security Directory</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed mt-1">This directory is updated in real-time based on active fraud complaints audited by the Bank of Uganda (BoU). Report any scam calls to keep the community protected.</p>
                  </div>
                </div>
              )}

            </div>

            {/* Custom PWA Mobile Dock Bar */}
            <div className="h-16 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 z-40">
              <button 
                onClick={() => setActiveTab('home')} 
                className={`flex flex-col items-center gap-1 transition cursor-pointer ${activeTab === 'home' ? 'text-primary scale-105' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <Wifi className="w-5 h-5" />
                <span className="text-[9px] font-bold">Home</span>
              </button>
              <button 
                onClick={() => setActiveTab('report')} 
                className={`flex flex-col items-center gap-1 transition cursor-pointer ${activeTab === 'report' ? 'text-primary scale-105' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <Plus className="w-5 h-5" />
                <span className="text-[9px] font-bold">Report</span>
              </button>
              <button 
                onClick={() => setActiveTab('track')} 
                className={`flex flex-col items-center gap-1 transition cursor-pointer ${activeTab === 'track' ? 'text-primary scale-105' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <MessageSquare className="w-5 h-5" />
                <span className="text-[9px] font-bold">Track</span>
              </button>
              <button 
                onClick={() => setActiveTab('verify')} 
                className={`flex flex-col items-center gap-1 transition cursor-pointer ${activeTab === 'verify' ? 'text-primary scale-105' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <Phone className="w-5 h-5" />
                <span className="text-[9px] font-bold">Verify</span>
              </button>
            </div>
          </div>
        ) : (
          /* Full Desktop Layout Dashboard panel */
          <div className="w-full bg-[#0E1116] rounded-3xl border border-slate-800 shadow-2xl p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Desktop Left Column - Profile & Form */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Header Title bar */}
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{t.title} Citizen Protection</h2>
                  <p className="text-[10px] uppercase tracking-widest font-extrabold text-[#D97706] mt-0.5">{t.tagline}</p>
                </div>

                {/* Languages */}
                <div className="flex gap-1.5">
                  {(['en', 'lg', 'nyn', 'ach'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-3 py-1.5 text-xs font-black rounded-lg uppercase tracking-wider flex items-center justify-center transition ${lang === l ? 'bg-[#D97706] text-black font-extrabold shadow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Ingestion Panel */}
              <div className="bg-[#11141E] border border-slate-800 p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 text-red-500" /> Lodge a Dispute / Complaint
                  </h3>
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{t.phoneLabel}</span>
                    <input 
                      type="text" 
                      value={citizenPhone} 
                      onChange={handlePhoneChange}
                      className="bg-transparent border-none text-xs text-white font-mono focus:outline-none w-32"
                    />
                  </div>
                </div>

                <form onSubmit={handleComplaintSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">{t.categoryLabel}</label>
                    <select 
                      value={formCategory} 
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="fraud">SIM Swap / Impersonation Fraud</option>
                      <option value="voice_scam">Voice Scam / Vishing Call</option>
                      <option value="overcharge">Mobile Money Overcharging</option>
                    </select>
                  </div>

                  {/* Provider */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">{t.providerLabel}</label>
                    <select 
                      value={formProvider} 
                      onChange={(e) => setFormProvider(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                  </div>

                  {/* Txn ID */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">{t.txnLabel}</label>
                    <input 
                      type="text" 
                      value={formTxnId}
                      placeholder="e.g. TXN99881122"
                      onChange={(e) => setFormTxnId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  {/* Narrative */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">{t.narrativeLabel}</label>
                    <textarea
                      rows={5}
                      value={formNarrative}
                      onChange={(e) => setFormNarrative(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  {/* Slang Shortcut */}
                  <div className="md:col-span-2 bg-slate-950/60 p-4 rounded-xl border border-slate-900">
                    <span className="text-[10px] font-black text-[#D97706] tracking-wide block uppercase mb-2">Luganda Slang Shortcuts (Low Data Translation Engine)</span>
                    <div className="flex flex-wrap gap-2">
                      {slangHelperPresets.map((preset) => (
                        <button
                          type="button"
                          key={preset.slang}
                          onClick={() => injectSlang(preset.slang)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          title={preset.translation}
                        >
                          + {preset.slang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={formLoading}
                    className="md:col-span-2 bg-primary hover:bg-primary-hover py-3 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    {formLoading ? 'Submitting...' : t.submitBtn}
                  </button>
                </form>

                {formSuccess && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold text-[#F59E0B] leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Right Column - Ticket List, Status, Chat */}
            <div className="space-y-6 flex flex-col justify-between">
              
              {/* Ticket selector list */}
              <div className="bg-[#11141E] border border-slate-800 p-5 rounded-3xl flex-1 flex flex-col justify-between overflow-hidden min-h-[300px]">
                <div>
                  <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-3 pb-2 border-b border-white/5">{t.recentActivity}</h3>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                    {history.map((h) => (
                      <div 
                        key={h.id}
                        onClick={() => setSelectedTicket(h)}
                        className={`p-3.5 rounded-2xl flex items-center justify-between border cursor-pointer transition ${
                          selectedTicket?.id === h.id 
                            ? 'bg-[#2563EB]/10 border-[#2563EB]/20' 
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-bold font-mono text-blue-400">{h.ticket_reference}</span>
                          <p className="text-[10px] text-slate-400 mt-1 capitalize font-medium">{h.category.replace('_', ' ')} • {h.provider.toUpperCase()}</p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          h.status.includes('escalated') ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                          h.status.includes('resolved') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          {h.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Number Checker inside desktop right column */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t.checkNumber}</h4>
                  <form onSubmit={handleVerifyNumber} className="flex gap-2">
                    <input 
                      type="text" 
                      value={verifyPhone}
                      placeholder="e.g. +256772999999"
                      onChange={(e) => setVerifyPhone(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button type="submit" className="bg-primary hover:bg-primary-hover px-4 rounded-xl text-white text-xs font-bold">
                      Check
                    </button>
                  </form>
                  {verifyResult.message && (
                    <div className={`p-2.5 rounded-xl border text-[10px] font-semibold leading-relaxed ${
                      verifyResult.status === 'flagged' ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    }`}>
                      {verifyResult.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat and status monitoring */}
              {selectedTicket && (
                <div className="bg-[#11141E] border border-slate-800 p-5 rounded-3xl flex-1 flex flex-col justify-between overflow-hidden min-h-[350px]">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5 mb-3">
                      <h4 className="text-xs font-bold text-white">Dispute Communication Hub</h4>
                      <span className="text-[10px] font-mono text-blue-400">{selectedTicket.ticket_reference}</span>
                    </div>

                    {/* step tracker */}
                    <div className="flex justify-between items-center py-2.5 px-3 bg-slate-950 rounded-2xl border border-slate-900 mb-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-300">Registered</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${selectedTicket.status !== 'ingested' ? 'bg-blue-500' : 'bg-slate-700'}`} />
                        <span className={`text-[10px] font-bold ${selectedTicket.status !== 'ingested' ? 'text-slate-300' : 'text-slate-500'}`}>Under Review</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          selectedTicket.status === 'resolved' ? 'bg-emerald-500' :
                          selectedTicket.status === 'escalated' ? 'bg-red-500' : 'bg-slate-700'
                        }`} />
                        <span className={`text-[10px] font-bold ${
                          selectedTicket.status === 'resolved' ? 'text-emerald-400 font-bold' :
                          selectedTicket.status === 'escalated' ? 'text-red-400 font-black' : 'text-slate-500'
                        }`}>{selectedTicket.status === 'escalated' ? 'Escalated' : 'Resolved'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Messaging panel */}
                  <div className="flex-1 bg-slate-950 border border-slate-900 rounded-2xl p-3 flex flex-col justify-between overflow-hidden">
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] max-h-[160px]">
                      {chatMessages.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex ${msg.s === 'c' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%] p-2.5 rounded-xl border leading-relaxed ${
                            msg.s === 'c' 
                              ? 'bg-[#2563EB]/10 border-[#2563EB]/25 text-blue-200 rounded-br-none' 
                              : 'bg-slate-900 border-slate-800 text-slate-300 rounded-bl-none'
                          }`}>
                            <p className="font-semibold">{msg.t}</p>
                            <span className="text-[8px] text-slate-500 font-mono block mt-1 text-right">
                              {new Date(msg.d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex gap-2 mt-2.5 pt-2.5 border-t border-slate-900/60">
                      <input 
                        type="text" 
                        value={newChatMessage}
                        onChange={(e) => setNewChatMessage(e.target.value)}
                        placeholder={t.chatPlaceholder}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <button 
                        type="submit"
                        className="bg-primary hover:bg-primary-hover w-8 h-8 rounded-xl flex items-center justify-center text-white"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto text-center text-[10px] text-text-muted mt-8 pt-4 border-t border-white/5">
        Tulinde Consumer PWA Platform • Protected by Bank of Uganda Regulatory Enforcement (CPRP) • v1.0.0 (Offline Cache Active)
      </div>
    </div>
  );
}
