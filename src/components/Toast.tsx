import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { cn } from '../lib/utils';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore, showToast as zustandShowToast } from '../stores/useToastStore';

export const showToast = zustandShowToast;

export function ToastContainer() {
  const activeToast = useToastStore((state) => state.activeToast);
  const removeToast = useToastStore((state) => state.removeToast);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -15 || info.velocity.y < -150) {
      if (activeToast) {
        removeToast(activeToast.id);
      }
    }
  };

  return (
    <div className="fixed top-4 sm:top-5 mt-[env(safe-area-inset-top,0px)] left-1/2 -translate-x-1/2 z-[100000] pointer-events-none flex items-center justify-center w-full px-4 box-border">
      <AnimatePresence>
        {activeToast && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.92 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 340,
              mass: 0.75,
              layout: { duration: 0.2, ease: 'easeOut' },
            }}
            drag="y"
            dragConstraints={{ bottom: 0, top: -80 }}
            dragElastic={{ top: 0.1, bottom: 0 }}
            dragSnapToOrigin={true}
            onDragEnd={handleDragEnd}
            onClick={() => removeToast(activeToast.id)}
            className={cn(
              'relative px-4 py-2.5 rounded-2xl sm:rounded-full shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25),0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl backdrop-saturate-180 border-t border-t-white/35 border-x border-x-white/15 border-b border-b-white/10 max-w-[92vw] sm:max-w-lg w-max pointer-events-auto cursor-grab active:cursor-grabbing text-on-surface transform-gpu will-change-transform bg-[color-mix(in_srgb,var(--surface-dim)_55%,transparent)] select-none overflow-hidden',
              activeToast.type === 'success' && 'shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.3),0_16px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.15)]',
              activeToast.type === 'error' && 'shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.3),0_16px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(244,63,94,0.15)]',
              activeToast.type === 'info' && 'shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.3),0_16px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.15)]'
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeToast.id}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex items-center gap-2.5 min-w-0"
              >
                {/* 3D Glowing Icon Badges */}
                {activeToast.type === 'success' && (
                  <div className="w-5.5 h-5.5 rounded-full bg-emerald-500/25 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} className="text-emerald-300 flex-shrink-0 drop-shadow-xs" />
                  </div>
                )}
                {activeToast.type === 'error' && (
                  <div className="w-5.5 h-5.5 rounded-full bg-rose-500/25 border border-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.35)] flex items-center justify-center flex-shrink-0">
                    <AlertCircle size={14} className="text-rose-300 flex-shrink-0 drop-shadow-xs" />
                  </div>
                )}
                {activeToast.type === 'info' && (
                  <div className="w-5.5 h-5.5 rounded-full bg-primary/25 border border-primary/50 shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-center justify-center flex-shrink-0">
                    <Info size={14} className="text-primary flex-shrink-0 drop-shadow-xs" />
                  </div>
                )}

                {/* Message Text */}
                <span className="text-[13px] sm:text-sm font-bold leading-snug tracking-tight break-words text-left flex-1 text-on-surface drop-shadow-xs">
                  {activeToast.message}
                </span>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
