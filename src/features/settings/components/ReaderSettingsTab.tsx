import React from 'react';
import { Palette, Type, Sliders, Layers, MonitorSmartphone } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { ThemeType, FontType } from '../../../shared/types';

const THEMES: { id: ThemeType; label: string; bg: string; color: string }[] = [
  { id: 'default', label: 'Mặc định', bg: '#1e1e1e', color: '#e3e3e3' },
  { id: 'sepia', label: 'Sepia Vàng', bg: '#fef3c7', color: '#78350f' },
  { id: 'modern-vn', label: 'Modern VN', bg: '#0b1326', color: '#dae2fd' },
  { id: 'amoled', label: 'AMOLED', bg: '#000000', color: '#ececec' },
  { id: 'midnight', label: 'Midnight', bg: '#0f172a', color: '#cbd5e1' },
  { id: 'obsidian', label: 'Obsidian', bg: '#0d0d12', color: '#a1a1aa' },
  { id: 'coffee', label: 'Coffee', bg: '#1c1814', color: '#d7c4b4' },
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
    isEnabledReplace, setIsEnabledReplace,
    bookLimit, setBookLimit,
    chapterLimit, setChapterLimit,
  } = useReaderConfigStore();

  return (
    <div className="space-y-6">
      {/* Theme selection */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5">
            <Palette size={14} className="text-primary" /> Chủ đề Giao diện (Theme)
          </span>
          <span className="text-[10px] font-mono text-primary font-bold uppercase">
            {THEMES.find((t) => t.id === theme)?.label}
          </span>
        </label>
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1 px-0.5">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTheme(item.id)}
                className={`px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all text-xs shrink-0 active:scale-95 ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 font-bold shadow-xs'
                    : 'border-outline-variant/30 hover:border-outline-variant/60'
                }`}
                style={{ backgroundColor: item.bg, color: item.color }}
              >
                <div className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: item.bg }} />
                <span className="text-xs truncate">{item.label}</span>
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
              className={`p-2.5 rounded-xl border text-xs font-medium transition-all ${
                font === item.id
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-container border-outline-variant/20 text-on-surface hover:bg-surface-container-high'
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
          className="w-full accent-primary"
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
              className={`py-1.5 rounded-lg border text-xs font-medium ${
                lineHeight === lh
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-container border-outline-variant/20 text-on-surface'
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
              className={`py-1.5 rounded-lg border text-xs font-medium ${
                groupLines === g
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-container border-outline-variant/20 text-on-surface'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Replace Switch & Limits */}
      <div className="pt-2 border-t border-outline-variant/20 space-y-4">
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
              className="w-full px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-on-surface-variant mb-1 block">Giới hạn Chương / Trang</label>
            <input
              type="number"
              value={chapterLimit}
              onChange={(e) => setChapterLimit(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs text-on-surface"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
