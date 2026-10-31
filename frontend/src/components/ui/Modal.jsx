import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Restrained subtle overlay */}
      <div
        className="fixed inset-0 bg-[#191B1D]/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Editorial Card Modal */}
      <div
        className={`relative w-full ${maxWidth} bg-[#F7F7F4] rounded-2xl border border-[#E6E5DE] shadow-[0_20px_50px_rgba(25,27,29,0.12)] overflow-hidden z-10`}
      >
        <div className="flex items-start justify-between p-6 sm:p-7 border-b border-[#E6E5DE] bg-white">
          <div>
            <h3 className="font-editorial text-2xl font-medium text-[#191B1D]">{title}</h3>
            {subtitle && <p className="text-xs text-[#7E828B] mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7E828B] hover:text-[#191B1D] hover:bg-[#F0EFEA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 sm:p-7 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
