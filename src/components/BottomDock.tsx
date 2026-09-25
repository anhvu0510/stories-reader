import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, ChevronUp, X, Check, Minus, Plus } from 'lucide-react';
import { BottomSheet } from './BottomSheet';
import { triggerHaptic } from '../hooks/useHaptic';

interface BottomDockProps {
  page?: number;
  totalPages?: number;
  total?: number;
  loading?: boolean;
  onPageChange?: (newPage: number) => void;
}

export function BottomDock({
  page = 1,
  totalPages = 1,
  total = 0,
  loading = false,
  onPageChange,
}: BottomDockProps) {
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(page);

  useEffect(() => {
    setTargetPage(page);
  }, [page]);

  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const handleGoToPage = (target: number) => {
    triggerHaptic('success');
    const validTarget = Math.max(1, Math.min(target, totalPages));
    if (validTarget !== page && onPageChange) {
      onPageChange(validTarget);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setShowPagePicker(false);
  };


  return (
    <>
      <nav className="fixed bottom-4 left-0 right-0 z-40 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-colors duration-200">
        <div className="bg-background/90 dark:bg-background/95 backdrop-blur-md border border-outline-variant/40 shadow-[0_16px_36px_rgba(0,0,0,0.5),_inset_0_1px_0.5px_0_rgba(255,255,255,0.35),_inset_0_-1px_0.5px_0_rgba(0,0,0,0.4)] rounded-full px-2.5 py-1.5 flex items-center justify-between pointer-events-auto transition-all duration-200 gap-2">
          {/* Prev Page Button (Rich "Trang X" format) */}
          <motion.button
            whileTap={canPrev ? { scale: 0.92 } : undefined}
            onClick={() => {
              if (canPrev && onPageChange) {
                triggerHaptic('light');
                onPageChange(page - 1);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
            }}
            disabled={!canPrev}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm ${
              canPrev
                ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary shadow-[0_4px_16px_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer'
                : 'bg-white/[0.06] backdrop-blur-md border border-white/40 text-on-surface-variant/50 shadow-[0_2px_10px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] cursor-not-allowed opacity-80'
            }`}
            title="Trang trước"
          >
            <ChevronLeft size={16} />
            <span>Trang {page > 1 ? page - 1 : 1}</span>
          </motion.button>

          {/* Vertical Divider */}
          <div className="w-[1px] h-4.5 bg-outline-variant/30 shadow-xs shrink-0" />

          {/* Center Interactive Page Indicator Pill */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              triggerHaptic('selection');
              setTargetPage(page);
              setShowPagePicker(true);
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-2xl bg-white/5 dark:bg-white/5 border border-outline-variant/30 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.25)] hover:border-primary/50 text-center flex flex-col items-center justify-center cursor-pointer transition-all group"
            title="Nhấp để chọn trang"
          >
            <div className="flex items-center justify-center gap-1 text-xs font-mono font-black text-primary truncate">
              <span>Trang {page}/{totalPages || 1}</span>
              <ChevronUp size={12} className="group-hover:-translate-y-0.5 transition-transform text-primary/70" />
            </div>
            {total > 0 && (
              <span className="text-[9.5px] font-mono text-on-surface-variant/70 block truncate leading-none mt-0.5">
                {total} truyện
              </span>
            )}
          </motion.button>

          {/* Vertical Divider */}
          <div className="w-[1px] h-4.5 bg-outline-variant/30 shadow-xs shrink-0" />

          {/* Next Page Button (Rich "Trang X" format) */}
          <motion.button
            whileTap={canNext ? { scale: 0.92 } : undefined}
            onClick={() => {
              if (canNext && onPageChange) {
                triggerHaptic('light');
                onPageChange(page + 1);
                window.scrollTo({ top: 0, behavior: 'auto' });
              }
            }}
            disabled={!canNext}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm ${
              canNext
                ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary shadow-[0_4px_16px_rgba(0,0,0,0.25),_inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer'
                : 'bg-white/[0.06] backdrop-blur-md border border-white/40 text-on-surface-variant/50 shadow-[0_2px_10px_rgba(0,0,0,0.3),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] cursor-not-allowed opacity-80'
            }`}
            title="Trang sau"
          >
            <span>{page < totalPages ? `Trang ${page + 1}` : 'Trang sau'}</span>
            <ChevronRight size={16} />
          </motion.button>
        </div>
      </nav>

      {/* Mobile-Native Touch Bottom Sheet Page Picker */}
      <BottomSheet
        isOpen={showPagePicker}
        onClose={() => setShowPagePicker(false)}
        ariaLabel="Nhảy Tới Trang"
        maxHeight="max-h-[85dvh]"
        contentClassName="p-4 sm:p-5 space-y-3.5"
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-black text-on-surface tracking-tight uppercase flex items-center gap-1.5">
              <span>🚀</span> NHẢY TỚI TRANG
            </h3>
            <button
              onClick={() => setShowPagePicker(false)}
              className="p-1 rounded-full hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Target Page Direct Input Hero Badge */}
        <div className="bg-white/[0.025] backdrop-blur-md border-2 border-outline-variant/60 rounded-2xl p-3 text-center space-y-1 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.25)]">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-bold text-on-surface-variant/80 uppercase tracking-wider">Trang</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={targetPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) {
                  setTargetPage(Math.max(1, Math.min(totalPages, val)));
                }
              }}
              className="w-20 text-center text-xl font-mono font-black text-primary bg-white/10 border-2 border-primary/50 rounded-xl px-2 py-1 focus:border-primary focus:bg-primary/20 outline-none transition-all shadow-inner"
            />
            <span className="text-xs font-mono text-on-surface-variant font-medium">/ {totalPages}</span>
          </div>
          <p className="text-[10px] font-mono text-on-surface-variant/60 pt-0.5">
            Gõ số trang, vuốt slider hoặc bấm mốc nhanh
          </p>
        </div>

        {/* Stepper Buttons & Range Slider */}
        <div className="flex items-center gap-3 bg-white/[0.025] backdrop-blur-md p-3 rounded-2xl border-2 border-outline-variant/60">
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => {
              triggerHaptic('light');
              setTargetPage((prev) => Math.max(1, prev - 1));
            }}
            disabled={targetPage <= 1}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-on-surface disabled:opacity-30 font-bold flex items-center justify-center shrink-0 transition-all cursor-pointer"
            title="Trang trước"
          >
            <Minus size={16} />
          </motion.button>

          <input
            type="range"
            min={1}
            max={totalPages}
            value={targetPage}
            onChange={(e) => {
              const val = Number(e.target.value);
              setTargetPage(val);
              triggerHaptic('selection');
            }}
            className="flex-1 accent-primary h-2 bg-white/10 rounded-lg cursor-pointer transition-all"
          />

          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => {
              triggerHaptic('light');
              setTargetPage((prev) => Math.min(totalPages, prev + 1));
            }}
            disabled={targetPage >= totalPages}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-on-surface disabled:opacity-30 font-bold flex items-center justify-center shrink-0 transition-all cursor-pointer"
            title="Trang sau"
          >
            <Plus size={16} />
          </motion.button>
        </div>

        {/* Quick Jump Presets (Mốc nhanh) */}
        {totalPages > 1 && (
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-wider px-1">
              ⚡ Mốc nhanh
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(() => {
                const p1 = 1;
                const p2 = Math.max(1, Math.round(totalPages * 0.25));
                const p3 = Math.max(1, Math.round(totalPages * 0.50));
                const p4 = Math.max(1, Math.round(totalPages * 0.75));
                const p5 = totalPages;
                const presets = Array.from(new Set([p1, p2, p3, p4, p5])).sort((a, b) => a - b);
                
                return presets.map((presetNum) => {
                  const isSelected = targetPage === presetNum;
                  let label = `Trang ${presetNum}`;
                  if (presetNum === 1) label = 'Đầu (1)';
                  else if (presetNum === totalPages) label = `Cuối (${totalPages})`;
                  else {
                    const pct = Math.round((presetNum / totalPages) * 100);
                    label = `${pct}% (${presetNum})`;
                  }

                  return (
                    <motion.button
                      key={presetNum}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        triggerHaptic('selection');
                        setTargetPage(presetNum);
                      }}
                      className={`py-2 px-1 rounded-xl text-[10px] font-mono font-extrabold border transition-all text-center truncate cursor-pointer ${
                        isSelected
                          ? 'bg-primary/25 border-2 border-primary text-primary shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
                          : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {label}
                    </motion.button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => handleGoToPage(targetPage)}
          className="w-full py-3.5 rounded-xl bg-primary text-on-primary text-xs font-extrabold border border-primary/70 shadow-[0_4px_16px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.4)] hover:brightness-110 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer mt-1"
        >
          <Check size={16} strokeWidth={3} />
          <span>Chuyển Tới Trang {targetPage}</span>
        </motion.button>
      </BottomSheet>
    </>
  );
}
