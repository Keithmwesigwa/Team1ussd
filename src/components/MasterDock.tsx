"use client";

import React from 'react';
import { Shield, Radio, Signal, Smartphone, Sun, Moon } from 'lucide-react';

interface MasterDockProps {
  currentRole: 'bou' | 'mtn' | 'airtel' | 'citizen';
  theme: 'light' | 'dark';
  onRoleChange: (role: 'bou' | 'mtn' | 'airtel' | 'citizen') => void;
  onThemeToggle: () => void;
  authSession?: { username: string; token: string } | null;
  onLogout?: () => void;
}

export default function MasterDock({ currentRole, theme, onRoleChange, onThemeToggle, authSession, onLogout }: MasterDockProps) {
  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4 bg-card-bg/85 backdrop-blur-md border-b border-card-border shadow-sm flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-3">
        {/* Logo/Icon based on current workspace */}
        <div className="p-2.5 rounded-xl bg-primary text-card-bg shadow-sm flex items-center justify-center transition-all duration-300">
          {currentRole === 'bou' && <Shield className="w-6 h-6" />}
          {currentRole === 'mtn' && <Radio className="w-6 h-6 text-black" />}
          {currentRole === 'airtel' && <Signal className="w-6 h-6 text-white" />}
          {currentRole === 'citizen' && <Smartphone className="w-6 h-6 text-white animate-pulse" />}
        </div>
        <div>
          <span className="text-xs uppercase tracking-widest font-semibold text-text-muted">
            {currentRole === 'citizen' ? "Citizen PWA Portal" : "Compliance Portal"}
          </span>
          <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
            {currentRole === 'bou' && "Bank of Uganda • CPRP Command Center"}
            {currentRole === 'mtn' && "CPRP Institution Console • MTN Uganda"}
            {currentRole === 'airtel' && "CPRP Institution Console • Airtel Uganda"}
            {currentRole === 'citizen' && "Tulinde • Consumer Protection Portal"}
          </h1>
        </div>
      </div>

      {/* Floating Controller Selector */}
      <div className="flex items-center gap-3 bg-progress-bg p-1.5 rounded-full border border-card-border shadow-inner">
        {/* BOU Mode Tab */}
        <button
          onClick={() => onRoleChange('bou')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            currentRole === 'bou'
              ? 'bg-[#800020] text-white shadow-md scale-105'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Shield className="w-4 h-4" />
          BoU Mode
        </button>

        {/* MTN Mode Tab */}
        <button
          onClick={() => onRoleChange('mtn')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            currentRole === 'mtn'
              ? 'bg-[#FFCC00] text-black shadow-md scale-105'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Radio className="w-4 h-4" />
          MTN Mode
        </button>

        {/* Airtel Mode Tab */}
        <button
          onClick={() => onRoleChange('airtel')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            currentRole === 'airtel'
              ? 'bg-[#E40000] text-white shadow-md scale-105'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Signal className="w-4 h-4" />
          Airtel Mode
        </button>

        {/* Citizen Mode Tab */}
        <button
          onClick={() => onRoleChange('citizen')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            currentRole === 'citizen'
              ? 'bg-[#2563EB] text-white shadow-md scale-105'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Citizen Portal
        </button>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {authSession && (
          <div className="hidden md:flex items-center gap-2 bg-[#11141E] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[10px] text-slate-400">Auth:</span>
            <span className="font-mono text-[10px] text-white max-w-[120px] truncate">{authSession.username}</span>
            {onLogout && (
              <button 
                onClick={onLogout}
                className="ml-2 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[9px] font-black text-red-400 hover:bg-red-500 hover:text-white transition cursor-pointer"
              >
                LOGOUT
              </button>
            )}
          </div>
        )}

        <button
          onClick={onThemeToggle}
          className="p-2.5 rounded-xl border border-card-border bg-card-bg hover:bg-progress-bg text-text-main shadow-sm flex items-center justify-center cursor-pointer transform hover:scale-105 transition-all duration-200"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="w-5 h-5 text-gray-700" /> : <Sun className="w-5 h-5 text-yellow-400" />}
        </button>
      </div>
    </header>
  );
}
