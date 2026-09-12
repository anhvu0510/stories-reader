import React from 'react';
import { Palette, Type, Sliders, Layers, MonitorSmartphone } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { ThemeType, FontType } from '../../../shared/types';

const THEMES: { id: ThemeType; label: string; bg: string; color: string }[] = [
  { id: 'default', label: 'Mặc định', bg: '#09090b', color: '#f4f4f5' },
  { id: 'sepia', label: 'Sepia Vàng', bg: '#fbf0d9', color: '#3b2314' },
  { id: 'modern-vn', label: 'Royal VN', bg: '#060e24', color: '#e2e8f0' },
  { id: 'amoled', label: 'AMOLED', bg: '#000000', color: '#f4f4f7' },
  { id: 'midnight', label: 'Midnight', bg: '#0b1120', color: '#f1f5f9' },
  { id: 'obsidian', label: 'Obsidian', bg: '#0c0a14', color: '#f3e8ff' },
  { id: 'coffee', label: 'Coffee', bg: '#171310', color: '#f5e6d3' },
];

const FONTS: { id: FontType; label: string }[] = [
  { id: 'default', label: 'Mặc định' },
  { id: 'palatino', label: 'Palatino' },
  { id: 'bookerly', label: 'Bookerly' },
  { id: 'font_viet_tay', label: 'Viết Tay' },
];

export function ReaderSettingsTab() {
  const {
    theme, setTheme,
    font, setFont,
    fontSize, setFontSize,
    lineHeight, setLineHeight,
    groupLines, setGroupLines,
    batchChapterSize, setBatchChapterSize,
    isEnabledReplace, setIsEnabledReplace,
    bookLimit, setBookLimit,
    chapterLimit, setChapterLimit,
  } = useReaderConfigStore();

  return (
    <div className="space-y-6">
      {/* Theme selection */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center justify-between mb-2.5">
          <span className="flex items-center gap-1.5">
            <Palette size={14} className="text-primary" /> Chủ đề Giao diện (Theme)
          </span>
          <span className="text-[10px] font-mono text-primary font-bold uppercase">
            {THEMES.find((t) => t.id === theme)?.label}
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all text-xs active:scale-[0.985] ${
                  isSelected
                    ? 'bg-primary/20 hover:bg-primary/25 backdrop-blur-md border-2 border-primary text-primary font-extrabold shadow-[0_4px_16px_rgba(0,0,0,0.25),_inset_0_1.5px_1.5px_rgba(255,255,255,0.6)]'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface hover:border-outline-variant/90'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full border border-white/30 shrink-0 shadow-xs flex items-center justify-center"
                    style={{ backgroundColor: item.bg }}
                  />
                  <span className="text-xs font-bold truncate">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Selection */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2.5">
          <Type size={14} className="text-primary" /> Phông chữ Reading
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFont(item.id)}
              className={`p-2.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                font === item.id
                  ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary font-extrabold shadow-[0_2px_8px_var(--primary)]'
                  : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Sliders size={14} className="text-primary" /> Cỡ chữ ({fontSize}px)
          </label>
        </div>
        <input
          type="range"
          min="14"
          max="32"
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />
      </div>

      {/* Line Height */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2">
          <Sliders size={14} className="text-primary" /> Khoảng cách dòng ({lineHeight})
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[1.2, 1.4, 1.6, 1.8].map((lh) => (
            <button
              key={lh}
              onClick={() => setLineHeight(lh)}
              className={`py-1.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                lineHeight === lh
                  ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary font-extrabold shadow-[0_2px_8px_var(--primary)]'
                  : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface'
              }`}
            >
              {lh}
            </button>
          ))}
        </div>
      </div>

      {/* Group Lines */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2">
          <Layers size={14} className="text-primary" /> Gộp dòng ({groupLines} dòng/đoạn)
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((g) => (
            <button
              key={g}
              onClick={() => setGroupLines(g)}
              className={`py-1.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                groupLines === g
                  ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary font-extrabold shadow-[0_2px_8px_var(--primary)]'
                  : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Chapter Size */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Sliders size={14} className="text-primary" /> Số chương gộp mỗi lần tải ({batchChapterSize || 1} chương)
          </label>
          <span className="text-[10px] text-on-surface-variant font-mono">1 - 10 chương</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="10"
            value={batchChapterSize || 1}
            onChange={(e) => setBatchChapterSize(Number(e.target.value))}
            className="w-20 px-3 py-1.5 rounded-lg bg-black/30 border border-blue-500/30 shadow-[inset_0_1px_0.5px_rgba(0,0,0,0.5)] text-xs text-primary font-mono font-bold text-center focus:border-primary/60 focus:outline-none transition-all"
          />
          <div className="flex-1 grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 5].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setBatchChapterSize(size)}
                className={`py-1.5 rounded-lg border text-xs font-medium transition-all active:scale-95 ${
                  (batchChapterSize || 1) === size
                    ? 'bg-primary/20 hover:bg-primary/30 backdrop-blur-md border border-primary/60 text-primary font-extrabold shadow-[0_2px_8px_var(--primary)]'
                    : 'bg-white/[0.025] hover:bg-white/[0.08] backdrop-blur-md border border-outline-variant/60 text-on-surface'
                }`}
              >
                {size} {size === 1 ? 'chương' : 'chương'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Replace Switch & Limits */}
      <div className="pt-2 border-t border-blue-500/20 dark:border-blue-400/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-on-surface">Bật Từ điển Thay thế</div>
            <div className="text-[11px] text-on-surface-variant/70">Áp dụng từ điển thay thế khi đọc truyện</div>
          </div>
          <input
            type="checkbox"
            checked={isEnabledReplace}
            onChange={(e) => setIsEnabledReplace(e.target.checked)}
            className="w-4 h-4 accent-primary rounded cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-medium text-on-surface-variant mb-1 block">Giới hạn Sách / Trang</label>
            <input
              type="number"
              value={bookLimit}
              onChange={(e) => setBookLimit(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-black/30 border border-blue-500/30 shadow-[inset_0_1px_0.5px_rgba(0,0,0,0.5)] text-xs text-primary font-mono font-bold focus:border-primary/60 focus:outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-on-surface-variant mb-1 block">Giới hạn Chương / Trang</label>
            <input
              type="number"
              value={chapterLimit}
              onChange={(e) => setChapterLimit(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-black/30 border border-blue-500/30 shadow-[inset_0_1px_0.5px_rgba(0,0,0,0.5)] text-xs text-primary font-mono font-bold focus:border-primary/60 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
