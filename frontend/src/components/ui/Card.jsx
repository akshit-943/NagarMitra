import React from 'react';

export default function Card({
  children,
  variant = 'white',
  className = '',
  padding = 'default',
  onClick,
  hoverable = false,
  ...props
}) {
  const variantStyles = {
    white: 'bg-white border-[#E6E5DE] text-[#191B1D]',
    warm: 'bg-[#F0EFEA] border-[#E6E5DE] text-[#191B1D]',
    lime: 'bg-[#F3F8D8] border-[#E1EFAC] text-[#191B1D]',
    lavender: 'bg-[#ECE8F9] border-[#DDD7F4] text-[#191B1D]',
    blue: 'bg-[#E3EEF8] border-[#CCE0F3] text-[#191B1D]',
    sage: 'bg-[#E3ECE1] border-[#CFDDD0] text-[#191B1D]',
    charcoal: 'bg-[#191B1D] border-[#2A2D31] text-white',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    default: 'p-6 sm:p-7',
    lg: 'p-8 sm:p-10',
  };

  const hoverStyle = hoverable
    ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(25,27,29,0.06)]'
    : '';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border ${variantStyles[variant]} ${paddingStyles[padding]} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
