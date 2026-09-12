import { motion, AnimatePresence } from 'motion/react';
import { BookOpen } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading?: boolean;
  message?: string;
}

export function LoadingOverlay({ isLoading = true }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/5 dark:bg-black/20 backdrop-blur-[1.5px] select-none pointer-events-auto overflow-hidden"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 360 }}
            className="relative flex items-center justify-center p-6 overflow-visible"
          >
            {/* Main Outer Crisp Gradient Spinning Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-visible"
            >
              <svg className="w-full h-full overflow-visible transform-gpu" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="spinner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
                    <stop offset="60%" stopColor="#34d399" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                {/* Background Track Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="5"
                />
                {/* Active Arc Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#spinner-grad)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeDasharray="210"
                  strokeDashoffset="65"
                />
              </svg>
            </motion.div>

            {/* Counter-Rotating Inner Ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="absolute w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center pointer-events-none overflow-visible"
            >
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--primary)"
                  strokeOpacity="0.5"
                  strokeWidth="3.5"
                  strokeDasharray="180"
                  strokeDashoffset="100"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>

            {/* Crisp Glass Book Icon Core (No outer blur glow bleed) */}
            <motion.div
              className="absolute flex items-center justify-center pointer-events-none overflow-visible"
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/15 dark:bg-white/10 backdrop-blur-md border border-primary/80 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
