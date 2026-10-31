import React from 'react';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
}) {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles = {
    lime: 'bg-[#F2F8D5] text-[#3E520A] border border-[#D2E873]',
    lavender: 'bg-[#ECE8F9] text-[#55478A] border border-[#DDD7F4]',
    blue: 'bg-[#E3EEF8] text-[#2C5370] border border-[#CDE0F3]',
    sage: 'bg-[#E3ECE1] text-[#365734] border border-[#CFDEC9]',
    charcoal: 'bg-[#191B1D] text-white border border-[#2B2D31]',
    neutral: 'bg-[#F0EFEA] text-[#4B4E54] border border-[#E6E5DE]',
    amber: 'bg-[#FAF0DE] text-[#865917] border border-[#EEDBBA]',
    rose: 'bg-[#FBEAE9] text-[#9E2B25] border border-[#F5C2BE]',
  };

  const dotColors = {
    lime: 'bg-[#8CA81F]',
    lavender: 'bg-[#7C6EB0]',
    blue: 'bg-[#3E7295]',
    sage: 'bg-[#507C4D]',
    charcoal: 'bg-white',
    neutral: 'bg-[#7E828B]',
    amber: 'bg-[#C28222]',
    rose: 'bg-[#D93F36]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant] || 'bg-current'}`} />}
      {children}
    </span>
  );
}
