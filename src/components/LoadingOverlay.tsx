import { motion, AnimatePresence } from 'motion/react';
import { Loader2, BookOpen } from 'lucide-react';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function LoadingOverlay({ isLoading, message = 'Đang tải dữ liệu...' }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.1 }}
            className="flex flex-col items-center justify-center p-8 bg-surface-container-high rounded-3xl shadow-2xl border border-outline-variant/30 max-w-[80vw]"
          >
            <div className="relative mb-6">
              {/* Outer pulsing ring */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 bg-primary rounded-full blur-xl"
              />
              
              {/* Inner animated core */}
              <div className="relative bg-surface rounded-full p-4 shadow-inner border border-outline-variant/20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                >
                  <Loader2 className="w-8 h-8 text-primary" />
                </motion.div>
                <motion.div
                  className="absolute inset-0 flex items-center justify-center"
                  animate={{ scale: [0.9, 1.1, 0.9] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <BookOpen className="w-3.5 h-3.5 text-primary opacity-80" />
                </motion.div>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-on-surface mb-1">Vui lòng đợi</h3>
            <p className="text-sm text-on-surface-variant text-center max-w-[200px] leading-relaxed">
              {message}
            </p>
            
            <div className="mt-6 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -5, 0] }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 0.6, 
                    delay: i * 0.1,
                    ease: "easeInOut" 
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-primary/60"
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
