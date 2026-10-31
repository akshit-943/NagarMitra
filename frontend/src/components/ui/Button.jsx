import React from 'react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-[#D2E873] hover:bg-[#C4DC61] text-[#191B1D] font-semibold active:scale-[0.98]',
    secondary: 'bg-[#191B1D] hover:bg-[#2B2E33] text-white active:scale-[0.98]',
    outline: 'border border-[#E6E5DE] bg-white hover:bg-[#F0EFEA] text-[#191B1D] active:scale-[0.98]',
    subtle: 'bg-[#F0EFEA] hover:bg-[#E6E5DE] text-[#191B1D] active:scale-[0.98]',
    ghost: 'text-[#4B4E54] hover:text-[#191B1D] hover:bg-[#F0EFEA]',
    danger: 'bg-[#FBEAE9] hover:bg-[#F8D5D2] text-[#9E2B25] border border-[#F5C2BE]',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      <span>{children}</span>
    </button>
  );
}
