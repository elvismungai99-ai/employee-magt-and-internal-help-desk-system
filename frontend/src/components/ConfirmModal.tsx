import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-200',
      icon: <AlertTriangle className="w-5 h-5" />,
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
      icon: <AlertCircle className="w-5 h-5" />,
      buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    primary: {
      iconBg: 'bg-[#e3f4f1] text-[#0e4a5c] border border-teal-200',
      icon: <Info className="w-5 h-5" />,
      buttonBg: 'bg-[#0e4a5c] hover:bg-[#083543] text-white',
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          onClick={() => {
            if (!isLoading) onClose();
          }}
        />

        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl border border-teal-100 transition-all w-full max-w-md my-8 p-6">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${variantConfig.iconBg}`}>
              {variantConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-[#0d2836] leading-snug">{title}</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{message}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 ${variantConfig.buttonBg}`}
            >
              {isLoading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
