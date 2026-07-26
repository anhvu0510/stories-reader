import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, X, Check } from 'lucide-react';

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
  const [inputPage, setInputPage] = useState<string>(String(page));

  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  const handleGoToPage = (target: number) => {
    if (target >= 1 && target <= totalPages && target !== page && onPageChange) {
      onPageChange(target);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setShowPagePicker(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(inputPage, 10);
    if (!isNaN(p)) {
      handleGoToPage(Math.max(1, Math.min(p, totalPages)));
    }
  };

  return (
    <>
      <nav className="fixed bottom-4 left-0 right-0 z-40 w-full max-w-md mx-auto px-4 pointer-events-none box-border overflow-x-hidden transition-colors duration-200">
        <div className="bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/30 shadow-2xl rounded-full px-2.5 py-1.5 flex items-center justify-between pointer-events-auto transform-gpu transition-all duration-200 gap-2">
          {/* Prev Page Button (Rich "Trang X" format) */}
          <button
            onClick={() => {
              if (canPrev && onPageChange) {
                onPageChange(page - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            disabled={!canPrev}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm active:scale-95 ${
              canPrev
                ? 'bg-primary text-on-primary hover:opacity-90'
                : 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed border border-transparent'
            }`}
            title="Trang trước"
          >
            <ChevronLeft size={16} />
            <span>Trang {page > 1 ? page - 1 : 1}</span>
          </button>

          {/* Center Interactive Page Indicator Pill */}
          <button
            onClick={() => {
              setInputPage(String(page));
              setShowPagePicker(true);
            }}
            className="flex-1 min-w-0 px-2 py-1 rounded-2xl bg-surface border border-outline-variant/20 hover:border-primary/40 text-center flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 group"
            title="Nhấp để nhảy trang nhanh"
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
          </button>

          {/* Next Page Button (Rich "Trang X" format) */}
          <button
            onClick={() => {
              if (canNext && onPageChange) {
                onPageChange(page + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            disabled={!canNext}
            className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-xs font-extrabold shadow-sm active:scale-95 ${
              canNext
                ? 'bg-primary text-on-primary hover:opacity-90'
                : 'bg-surface-container text-on-surface-variant/30 cursor-not-allowed border border-transparent'
            }`}
            title="Trang sau"
          >
            <span>{page < totalPages ? `Trang ${page + 1}` : 'Trang sau'}</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>

      {/* Quick Page Picker Modal */}
      {showPagePicker && (
        <div className="fixed inset-0 z-[90000] bg-black/60 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowPagePicker(false)} />

          <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-xs rounded-3xl border border-outline-variant/30 shadow-2xl p-5 flex flex-col gap-4 animate-none">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-1.5">
                Nhảy tới trang
              </h3>
              <button
                onClick={() => setShowPagePicker(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                autoFocus
                className="flex-1 h-11 px-3.5 rounded-2xl bg-surface border border-outline-variant/40 text-center font-mono font-extrabold text-sm text-on-surface focus:outline-none focus:border-primary"
                placeholder={`1 - ${totalPages}`}
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-2xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1 shadow-sm hover:opacity-90 transition-all"
              >
                <Check size={14} /> Đi
              </button>
            </form>

            {/* Quick Page Shortcut Buttons */}
            {totalPages > 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline-variant/10">
                {Array.from({ length: Math.min(totalPages, 6) }, (_, i) => i + 1).map((pNum) => (
                  <button
                    key={pNum}
                    onClick={() => handleGoToPage(pNum)}
                    className={`flex-1 min-w-[42px] py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                      pNum === page
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Trang {pNum}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
