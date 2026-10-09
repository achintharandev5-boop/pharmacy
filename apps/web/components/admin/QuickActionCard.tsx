'use client';

import React from 'react';
import Link from 'next/link';
import { LucideIcon, ArrowRight, Printer, Boxes, Users, FileText } from 'lucide-react';

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  ctaText: string;
  gradient: string;
  icon: LucideIcon;
  badgeText?: string;
  graphicType?: 'printer' | 'inventory' | 'patients';
}

export default function QuickActionCard({
  title,
  description,
  href,
  ctaText,
  gradient,
  icon: Icon,
  graphicType = 'printer',
}: QuickActionProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-[0_6px_24px_rgba(37,99,235,0.12)] flex flex-col justify-between group transition-all duration-200 hover:shadow-[0_10px_30px_rgba(37,99,235,0.20)] hover:-translate-y-0.5 select-none min-h-[148px]"
      style={{ background: gradient }}
    >
      {/* Decorative Soft Background Glow & Floating Graphic */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />

      {/* Decorative SVG Graphic in background right corner */}
      <div className="absolute right-3 bottom-2 opacity-15 group-hover:opacity-25 transition-opacity duration-300 pointer-events-none">
        {graphicType === 'printer' && (
          <Printer className="w-20 h-20 text-white transform -rotate-12" strokeWidth={1.2} />
        )}
        {graphicType === 'inventory' && (
          <Boxes className="w-20 h-20 text-white transform rotate-6" strokeWidth={1.2} />
        )}
        {graphicType === 'patients' && (
          <Users className="w-20 h-20 text-white transform -rotate-6" strokeWidth={1.2} />
        )}
      </div>

      <div className="relative z-10 space-y-2 max-w-[82%]">
        {/* Icon & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-2xs">
            <Icon className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <h3 className="text-[15px] sm:text-base font-bold tracking-tight text-white leading-snug">
            {title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-xs text-white/90 leading-relaxed font-normal line-clamp-2">
          {description}
        </p>
      </div>

      {/* Button CTA */}
      <div className="relative z-10 mt-3 pt-1">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-[#0F172A] hover:bg-slate-50 font-bold text-xs shadow-xs transition-all duration-150 active:scale-95 group/btn"
        >
          <span>{ctaText}</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#2563EB] group-hover/btn:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
