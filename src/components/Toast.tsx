import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore, showToast as zustandShowToast, ToastType } from '../stores/useToastStore';

export const showToast = zustandShowToast;

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="fixed top-8 sm:top-6 mt-[env(safe-area-inset-top,0px)] left-1/2 -translate-x-1/2 z-[100000] flex flex-col gap-2 pointer-events-none items-center">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            onClick={() => removeToast(toast.id)}
            className={cn(
              'px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 backdrop-blur-xl border max-w-[90vw] sm:max-w-md w-max pointer-events-auto cursor-pointer',
              toast.type === 'success' && 'bg-emerald-500/95 border-emerald-400 text-white',
              toast.type === 'error' && 'bg-red-500/95 border-red-400 text-white',
              toast.type === 'info' && 'bg-surface-container-highest/95 border-outline-variant/30 text-on-surface'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 size={16} className="text-white flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={16} className="text-white flex-shrink-0" />}
            {toast.type === 'info' && <Info size={16} className="text-on-surface-variant flex-shrink-0" />}

            <span className="text-[13px] sm:text-sm font-bold leading-tight truncate">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
