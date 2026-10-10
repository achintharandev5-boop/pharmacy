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
          ? 'bg-primary text-white border-2 border-primary-hover' 
          : 'bg-white text-fg border border-border-strong hover:bg-surface-2 active:bg-border'
      } ${disabled ? 'opacity-40 pointer-events-none cursor-not-allowed bg-surface border-border text-subtle' : 'active:brightness-95'} ${className}`}
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
