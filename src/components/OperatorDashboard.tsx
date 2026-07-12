"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, UserX, MessageSquareWarning, ArrowRight, Lock, 
  Send, CheckCircle, ShieldCheck, MapPin, AlertCircle, RefreshCw, KeyRound 
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

interface OperatorDashboardProps {
  operatorName: 'mtn' | 'airtel';
  complaints: Complaint[];
  onRefresh: () => void;
}

export default function OperatorDashboard({ operatorName, complaints, onRefresh }: OperatorDashboardProps) {
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ status: 'success' | 'error' | null; message: string | null }>({
    status: null,
    message: null
  });
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'sim_swap' | 'voice_scam' | 'overcharge'>('all');

  // Hard boundary isolation: Filter complaints down to only this operator's tickets
  const isolatedComplaints = complaints.filter(c => c.network_provider === operatorName);

  // Filter by ticket queues
  const filteredComplaints = categoryFilter === 'all' 
    ? isolatedComplaints 
    : isolatedComplaints.filter(c => c.category === categoryFilter);

  // Auto select ticket if none selected
  useEffect(() => {
    if (filteredComplaints.length > 0) {
      // Find if current selected ticket is in the filtered list, otherwise reset
      const exists = filteredComplaints.some(c => c.id === selectedTicket?.id);
      if (!exists) {
        setSelectedTicket(filteredComplaints[0]);
      }
    } else {
      setSelectedTicket(null);
    }
  }, [categoryFilter, operatorName, complaints]);

  // Counts for each queue category
  const simSwapCount = isolatedComplaints.filter(c => c.category === 'sim_swap' && c.status !== 'resolved').length;
  const voiceScamCount = isolatedComplaints.filter(c => c.category === 'voice_scam' && c.status !== 'resolved').length;
  const overchargeCount = isolatedComplaints.filter(c => c.category === 'overcharge' && c.status !== 'resolved').length;

  const triggerAction = async (action: 'wallet_freeze' | 'flash_sms_intercept' | 'resolve_dispute', simulateBreach = false) => {
    setActionLoading(true);
    setActionResult({ status: null, message: null });

    try {
      // Multi-tenancy simulation parameters:
      // If simulateBreach is true, we pass the opposite operator token to test backend isolation security!
      const identityToken = simulateBreach 
        ? (operatorName === 'mtn' ? 'airtel' : 'mtn')
        : operatorName;

      const bodyPayload: any = {
        action,
        operator_identity: `${identityToken}_operator_agent_console`,
        target_phone: customPhone || (selectedTicket ? selectedTicket.subscriber_phone : undefined)
      };

      if (selectedTicket) {
        bodyPayload.complaint_id = selectedTicket.id;
      }

      const res = await fetch('http://localhost:3001/api/v1/telecom/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Operator-Identity': identityToken // Multi-tenancy header checks
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (res.status === 200) {
        setActionResult({
          status: 'success',
          message: data.message
        });
        setCustomPhone('');
        onRefresh();
      } else {
        setActionResult({
          status: 'error',
          message: data.error || 'Operation failed.'
        });
      }
    } catch (err) {
      setActionResult({
        status: 'error',
        message: 'Network error communicating with Core Gateway.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Calculates exact hours & minutes remaining before SLA breach
  const getTimeRemainingStr = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return 'SLA BREACHED (Escalated to BoU)';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining before BoU Escalation`;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      
      {/* SECTION 1: HIGH-PRIORITY CATEGORY QUEUES CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: SIM Swap Fraud Queue */}
        <button
          onClick={() => setCategoryFilter('sim_swap')}
          className={`p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
            categoryFilter === 'sim_swap'
              ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
              : 'border-card-border bg-card-bg shadow-sm hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-bold text-text-muted">SIM Swap Fraud</span>
            <UserX className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-black text-text-main">{simSwapCount}</h3>
          <p className="text-xs text-text-muted mt-2">Active unauthorized SIM replacements</p>
        </button>

        {/* Card 2: Voice Scam / Social Engineering Queue */}
        <button
          onClick={() => setCategoryFilter('voice_scam')}
          className={`p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
            categoryFilter === 'voice_scam'
              ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
              : 'border-card-border bg-card-bg shadow-sm hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-bold text-text-muted">Social Engineering / Vishing</span>
            <MessageSquareWarning className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-black text-text-main">{voiceScamCount}</h3>
          <p className="text-xs text-text-muted mt-2">Active phone vishing and extortion logs</p>
        </button>

        {/* Card 3: Mobile Money Extortions */}
        <button
          onClick={() => setCategoryFilter('overcharge')}
          className={`p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
            categoryFilter === 'overcharge'
              ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
              : 'border-card-border bg-card-bg shadow-sm hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-bold text-text-muted">MM Cash-Out / Charges</span>
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-3xl font-black text-text-main">{overchargeCount}</h3>
          <p className="text-xs text-text-muted mt-2">Active wallet overcharging & sandbox claims</p>
        </button>

      </div>

      {/* SECTION 2: QUEUE DETAILS & GATEWAY CONTROL INTEGRATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List (Left 2 Columns) */}
        <div className="lg:col-span-2 rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-card-border">
            <div>
              <h3 className="text-base font-bold text-text-main capitalize">
                {categoryFilter === 'all' ? 'Active Incoming Claims Queue' : `${categoryFilter.replace('_', ' ')} Queue`}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Select a claimant ticket to activate network controls</p>
            </div>
            
            {categoryFilter !== 'all' && (
              <button 
                onClick={() => setCategoryFilter('all')}
                className="text-xs text-primary font-bold hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
            {filteredComplaints.map((c) => {
              const isSelected = selectedTicket?.id === c.id;
              const isResolved = c.status === 'resolved';

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedTicket(c)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-card-border bg-progress-bg/30 hover:bg-progress-bg/60'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-main">{c.ticket_reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        c.status === 'resolved' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : c.status === 'escalated' 
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-text-main flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-text-muted" /> {c.district} • Subscriber: {c.subscriber_phone}
                    </span>

                    <span className="text-xs font-semibold text-primary font-mono mt-1">
                      {isResolved ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4" /> Dispute Resolved (SLA Halted)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-primary" /> {getTimeRemainingStr(c.sla_deadline)}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-1 text-right">
                    <span className="text-sm font-black text-text-main">
                      UGX {c.amount_ugx.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-text-muted capitalize">
                      Channel: {c.channel_source}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredComplaints.length === 0 && (
              <div className="text-center py-12 text-xs text-text-muted">
                No active tickets in this queue category.
              </div>
            )}
          </div>
        </div>

        {/* Network Gateway Controls (Right Column) */}
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 shadow-sm flex flex-col gap-6 justify-between">
          <div className="flex flex-col gap-4">
            <div className="pb-3 border-b border-card-border">
              <h3 className="text-base font-bold text-text-main">Gateway Network Controls</h3>
              <p className="text-xs text-text-muted mt-0.5">Perform immediate core network actions</p>
            </div>

            {/* Suspect Phone input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-text-muted">Target Suspect MSISDN</label>
              <input
                type="text"
                placeholder={selectedTicket ? selectedTicket.subscriber_phone : "+256..."}
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-card-border bg-progress-bg/40 focus:bg-card-bg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary text-text-main"
              />
              <span className="text-[9px] text-text-muted">Defaults to the selected ticket's phone if left empty.</span>
            </div>

            {/* Control Actions */}
            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={() => triggerAction('wallet_freeze')}
                disabled={actionLoading}
                className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-accent text-accent-fg border border-primary/20 hover:bg-primary hover:text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <span>Temporary Wallet Freeze/Hold</span>
                <Lock className="w-4 h-4" />
              </button>

              <button
                onClick={() => triggerAction('flash_sms_intercept')}
                disabled={actionLoading}
                className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-accent text-accent-fg border border-primary/20 hover:bg-primary hover:text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <span>Trigger Flash SMS Nudge</span>
                <Send className="w-4 h-4" />
              </button>

              {selectedTicket && selectedTicket.status !== 'resolved' && (
                <button
                  onClick={() => triggerAction('resolve_dispute')}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50"
                >
                  <span>Resolve & Halt SLA Countdown</span>
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* SLA Security Demo Sandbox (HTTP 403 tester) */}
          <div className="pt-4 border-t border-card-border flex flex-col gap-3.5">
            <div>
              <h4 className="text-xs font-bold text-text-main flex items-center gap-1">
                <KeyRound className="w-4 h-4 text-primary" /> Tenant Isolation Security Box
              </h4>
              <p className="text-[10px] text-text-muted mt-0.5">
                Simulate a cross-tenant boundary breach. Attempt to perform an action using credentials from the other network.
              </p>
            </div>

            <button
              onClick={() => triggerAction('wallet_freeze', true)}
              disabled={actionLoading || (!selectedTicket && !customPhone)}
              className="w-full py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 font-semibold text-xs tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              Simulate Cross-Tenant Mutation Attack
            </button>
          </div>

          {/* Action Response Display */}
          {actionResult.message && (
            <div className={`p-3.5 rounded-xl border text-xs flex gap-2 items-start mt-2 ${
              actionResult.status === 'success' 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400'
            }`}>
              <span className="font-bold">{actionResult.status === 'success' ? 'Success:' : 'Error:'}</span>
              <span>{actionResult.message}</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
