'use client';

import React, { useActionState, useState } from 'react';
import { handleLogin } from '../actions/auth';
import { Lock, Mail, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(handleLogin, { error: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <main className="min-h-screen bg-[#F5F9FF] flex flex-col items-center justify-center p-4 relative selection:bg-blue-100 selection:text-blue-900 select-none font-sans">
      {/* Background Soft Radial Gradient Layer */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 45%),
            linear-gradient(180deg, #F8FBFF 0%, #F3F8FF 100%)
          `,
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/92 backdrop-blur-xl p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-[0_12px_40px_rgba(15,23,42,0.06)] space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#3B82F6] text-white flex items-center justify-center shadow-[0_6px_20px_rgba(37,99,235,0.30)] mx-auto">
              <span className="font-extrabold text-2xl tracking-tight leading-none italic font-serif">℞</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Pharmacy System
            </h1>
            <p className="text-xs text-[#64748B] font-medium">
              Prescription Labels & Inventory • Sisila Chemist
            </p>
          </div>

          {/* Error Banner */}
          {state?.error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{state.error}</span>
              </div>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                  className="w-full h-11 pl-10 pr-4 bg-[#F8FBFF] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="w-full h-11 pl-10 pr-4 bg-[#F8FBFF] hover:bg-white focus:bg-white border border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 rounded-xl text-xs font-semibold text-[#0F172A] outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white rounded-xl text-xs font-bold shadow-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>{isPending ? 'Verifying Credentials...' : 'Sign In to Workstation'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
