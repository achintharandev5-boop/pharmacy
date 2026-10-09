'use client';
import React from 'react';

export function ToggleButton({ 
  label, 
  isActive, 
  onClick, 
  className = '',
  disabled = false
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void; 
  className?: string;
  disabled?: boolean;
}) {
  const isMultiWord = label.includes(' ') || label.length > 9;

  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-black tracking-tight leading-tight rounded-none flex items-center justify-center p-1.5 text-center select-none touch-manipulation transition-all duration-75 ${
        isMultiWord 
          ? 'text-xs sm:text-sm lg:text-base' 
          : 'text-base sm:text-lg lg:text-xl'
      } ${
        isActive 
          ? 'bg-[#2563EB] text-white border-2 border-[#1D4ED8]' 
          : 'bg-white text-[#0F172A] border border-[#CBD5E1] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]'
      } ${disabled ? 'opacity-40 pointer-events-none cursor-not-allowed bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]' : 'active:brightness-95'} ${className}`}
      style={{
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {label}
    </button>
  );
}
