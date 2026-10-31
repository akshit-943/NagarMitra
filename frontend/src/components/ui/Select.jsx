import React from 'react';

export default function Select({
  label,
  error,
  options = [],
  id,
  className = '',
  ...props
}) {
  const selectId = id || props.name;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-[#191B1D]">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-xl bg-white border ${
          error ? 'border-[#E65B54]' : 'border-[#E6E5DE] focus:border-[#191B1D]'
        } px-3.5 py-2.5 text-sm text-[#191B1D] transition-colors focus:outline-none appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#C8342D]">{error}</p>}
    </div>
  );
}
