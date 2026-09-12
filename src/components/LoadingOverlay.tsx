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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 dark:bg-black/30 backdrop-blur-md select-none pointer-events-auto overflow-hidden"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 360 }}
            className="relative flex items-center justify-center p-8 overflow-visible"
          >
            {/* Pure Circular Smooth Radial Glow (No CSS filter blur box artifacts) */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.4, 0.8] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute w-36 h-36 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(52, 211, 153, 0.08) 50%, transparent 70%)',
              }}
            />

            {/* Main Outer 3D Gradient Spinning Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
              className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-visible"
            >
              <svg className="w-full h-full overflow-visible transform-gpu" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="spinner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
                    <stop offset="50%" stopColor="#34d399" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Background Guide Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="6"
                />
                {/* Glowing Active Arc Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#spinner-grad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="200"
                  strokeDashoffset="60"
                />
              </svg>
            </motion.div>

            {/* Counter-Rotating Inner Ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'linear' }}
              className="absolute w-11 h-11 sm:w-13 sm:h-13 flex items-center justify-center pointer-events-none overflow-visible"
            >
              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.45)"
                  strokeWidth="4"
                  strokeDasharray="180"
                  strokeDashoffset="110"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>

            {/* Glowing 3D Book Icon Core */}
            <motion.div
              className="absolute flex items-center justify-center pointer-events-none overflow-visible"
              animate={{ scale: [0.92, 1.1, 0.92] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/80 border border-amber-400/60 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_0_14px_rgba(245,158,11,0.5)]">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 drop-shadow-[0_2px_4px_rgba(245,158,11,0.8)]" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
