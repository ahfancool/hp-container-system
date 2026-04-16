import React, { useEffect } from "react";
import { Card } from "./Card";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  type?: "default" | "bottom-sheet";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  type = "default"
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isBottomSheet = type === "bottom-sheet";

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="absolute inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      <Card 
        className={`relative w-full max-w-lg bg-white shadow-2xl animate-in slide-in-from-bottom duration-300 ${
          isBottomSheet ? "rounded-t-[32px] rounded-b-none sm:rounded-[32px] pb-8 sm:pb-6" : "rounded-[24px]"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-xl font-bold text-ink">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-strong rounded-full transition-colors"
            aria-label="Tutup modal"
          >
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-8">
          {children}
        </div>

        {footer && (
          <div className="flex flex-col gap-3">
            {footer}
          </div>
        )}
      </Card>
    </div>
  );
};
