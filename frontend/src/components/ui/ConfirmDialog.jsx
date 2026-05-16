import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger', // 'danger' | 'primary'
  isLoading = false,
  children,
}) {
  if (!isOpen) return null;

  const btnClass = confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-modal w-full max-w-md animate-slide-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="p-6">
            {/* Icon */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              confirmVariant === 'danger' ? 'bg-danger-50' : 'bg-primary-50'
            }`}>
              <ExclamationTriangleIcon className={`w-6 h-6 ${
                confirmVariant === 'danger' ? 'text-danger-600' : 'text-primary-600'
              }`} />
            </div>

            <h3 id="confirm-title" className="text-lg font-semibold text-slate-800 mb-2">
              {title}
            </h3>

            {description && (
              <p className="text-sm text-muted mb-4">{description}</p>
            )}

            {children && (
              <div className="mb-4">{children}</div>
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={btnClass}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75"/>
                    </svg>
                    Processing...
                  </span>
                ) : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
