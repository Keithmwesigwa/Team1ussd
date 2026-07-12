"use client";

import React from 'react';
import { Shield, Radio, Signal, Sun, Moon } from 'lucide-react';

interface MasterDockProps {
  currentRole: 'bou' | 'mtn' | 'airtel';
  theme: 'light' | 'dark';
  onRoleChange: (role: 'bou' | 'mtn' | 'airtel') => void;
  onThemeToggle: () => void;
}

export default function MasterDock({ currentRole, theme, onRoleChange, onThemeToggle }: MasterDockProps) {
  return (
    <header className="sticky top-0 z-50 w-full px-6 py-4 bg-card-bg/85 backdrop-blur-md border-b border-card-border shadow-sm flex items-center justify-between transition-all duration-300">
      <div className="flex items-center gap-3">
        {/* Logo/Icon based on current workspace */}
        <div className="p-2.5 rounded-xl bg-primary text-card-bg shadow-sm flex items-center justify-center transition-all duration-300">
          {currentRole === 'bou' && <Shield className="w-6 h-6" />}
          {currentRole === 'mtn' && <Radio className="w-6 h-6 text-black" />}
          {currentRole === 'airtel' && <Signal className="w-6 h-6 text-white" />}
        </div>
        <div>
          <span className="text-xs uppercase tracking-widest font-semibold text-text-muted">Compliance Portal</span>
          <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
            {currentRole === 'bou' && "Bank of Uganda • CPRP Command Center"}
            {currentRole === 'mtn' && "CPRP Institution Console • MTN Uganda"}
            {currentRole === 'airtel' && "CPRP Institution Console • Airtel Uganda"}
          </h1>
        </div>
      </div>

      {/* Floating Controller Selector */}
      <div className="flex items-center gap-4 bg-progress-bg p-1.5 rounded-full border border-card-border shadow-inner">
        {/* BOU Mode Tab */}
        <button
          onClick={() => onRoleChange('bou')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
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
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
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
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
            currentRole === 'airtel'
              ? 'bg-[#E40000] text-white shadow-md scale-105'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Signal className="w-4 h-4" />
          Airtel Mode
        </button>
      </div>

      {/* Dark/Light mode switch */}
      <button
        onClick={onThemeToggle}
        className="p-2.5 rounded-xl border border-card-border bg-card-bg hover:bg-progress-bg text-text-main shadow-sm flex items-center justify-center cursor-pointer transform hover:scale-105 transition-all duration-200"
        title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      >
        {theme === 'light' ? <Moon className="w-5 h-5 text-gray-700" /> : <Sun className="w-5 h-5 text-yellow-400" />}
      </button>
    </header>
  );
}
