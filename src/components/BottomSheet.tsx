import React, { useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'motion/react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { cn } from '../lib/utils';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showDragHandle?: boolean;
  maxHeight?: string;
  zIndex?: string;
  ariaLabel?: string;
  disableDrag?: boolean;
  glassmorphic?: boolean;
  'data-testid'?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  showDragHandle = true,
  maxHeight = 'max-h-[88dvh]',
  zIndex = 'z-[99000]',
  ariaLabel = 'Modal Sheet',
  disableDrag = false,
  glassmorphic = true,
  'data-testid': testId,
}: BottomSheetProps) {
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          data-testid={testId}
          className={cn(
            'fixed inset-0 flex items-end justify-center overscroll-none overflow-x-hidden box-border',
            zIndex,
            className
          )}
        >
          {/* Backdrop Blur Overlay */}
          <motion.div
            data-testid="bottom-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            className="absolute inset-0 bg-black/15 backdrop-blur-[1.5px]"
          />

          {/* Bottom Sheet Card Container */}
          <motion.div
            data-testid="bottom-sheet-container"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.85 }}
            drag={disableDrag ? false : 'y'}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            dragSnapToOrigin={true}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative z-10 w-full max-w-md mx-auto text-on-surface rounded-t-[32px] border-t sm:border shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden hide-scrollbar no-scrollbar box-border transform-gpu transition-colors duration-200 will-change-transform',
              glassmorphic
                ? 'bg-[color-mix(in_srgb,color-mix(in_srgb,var(--surface)_40%,#000000)_40%,transparent)] backdrop-blur-sm backdrop-saturate-150 border-white/10 dark:border-white/10'
                : 'bg-surface border-outline-variant/40',
              maxHeight,
              contentClassName
            )}
          >
            {/* Ambient Top Glow Effect */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-28 bg-primary/15 blur-3xl pointer-events-none rounded-full" />

            {/* Optional Top Drag Handle */}
            {showDragHandle && (
              <div className="pt-2.5 pb-1 flex justify-center flex-shrink-0 cursor-grab active:cursor-grabbing relative z-20">
                <div className="w-10 h-1 rounded-full bg-on-surface-variant/30" />
              </div>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

