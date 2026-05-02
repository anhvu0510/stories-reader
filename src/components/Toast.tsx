import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastListener: ((toast: ToastMessage | null) => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  if (toastListener) {
    toastListener({ id: Date.now().toString(), message, type });
  }
};

export function ToastContainer() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    toastListener = setToast;
    
    const handleAppToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setToast({
          id: Date.now().toString(),
          message: customEvent.detail.message,
          type: customEvent.detail.type || 'info'
        });
      }
    };
    
    window.addEventListener('app-toast', handleAppToast);
    
    return () => { 
      toastListener = null; 
      window.removeEventListener('app-toast', handleAppToast);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
           key={toast.id}
           initial={{ opacity: 0, y: -20, scale: 0.95 }}
           animate={{ opacity: 1, y: 0, scale: 1 }}
           exit={{ opacity: 0, y: -20, scale: 0.95 }}
           className={cn(
             "fixed top-8 sm:top-6 mt-[env(safe-area-inset-top,0px)] left-1/2 -translate-x-1/2 z-[100000] px-4 py-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 backdrop-blur-xl border max-w-[90vw] sm:max-w-md w-max pointer-events-none",
             toast.type === 'success' && 'bg-emerald-500/95 border-emerald-400 text-white',
             toast.type === 'error' && 'bg-red-500/95 border-red-400 text-white',
             toast.type === 'info' && 'bg-surface-container-highest/95 border-outline-variant/30 text-on-surface'
           )}
        >
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-white flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle size={18} className="text-white flex-shrink-0" />}
          {toast.type === 'info' && <Info size={18} className="text-on-surface-variant flex-shrink-0" />}
          
          <span className="text-[13px] sm:text-sm font-bold leading-tight truncate">{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
