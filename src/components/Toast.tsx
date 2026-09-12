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
              'px-4 py-3 rounded-full shadow-[0_12px_32px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.45)] flex items-center gap-3 backdrop-blur-[6px] border max-w-[90vw] sm:max-w-md w-max pointer-events-auto cursor-pointer transition-all',
              toast.type === 'success' && 'bg-black/40 border-amber-400/50 text-white',
              toast.type === 'error' && 'bg-black/40 border-rose-500/50 text-white',
              toast.type === 'info' && 'bg-black/40 border-blue-400/40 text-white'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />}
            {toast.type === 'info' && <Info size={16} className="text-blue-400 flex-shrink-0" />}

            <span className="text-[13px] sm:text-sm font-bold leading-tight truncate">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
