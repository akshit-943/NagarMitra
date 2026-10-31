import React from 'react';

export default function Input({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#191B1D]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl bg-white border ${
          error ? 'border-[#E65B54] focus:ring-[#E65B54]' : 'border-[#E6E5DE] focus:border-[#191B1D]'
        } px-3.5 py-2.5 text-sm text-[#191B1D] placeholder-[#A2A6B0] transition-colors focus:outline-none ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#C8342D]">{error}</p>}
      {helperText && !error && <p className="text-xs text-[#7E828B]">{helperText}</p>}
    </div>
  );
}
