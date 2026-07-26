import React from 'react';
import { X, Type, Minus, Plus, Palette } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { FontType, ThemeType } from '../../../shared/types';

interface QuickTypographySheetProps {
  onClose: () => void;
}

export function QuickTypographySheet({ onClose }: QuickTypographySheetProps) {
  const {
    fontSize, setFontSize,
    theme, setTheme,
    font, setFont,
  } = useReaderConfigStore();

  const themes: { id: ThemeType; name: string; bg: string; text: string }[] = [
    { id: 'default', name: 'Tối', bg: '#09090b', text: '#f4f4f5' },
    { id: 'sepia', name: 'Sepia', bg: '#fef3c7', text: '#78350f' },
    { id: 'amoled', name: 'Đen', bg: '#000000', text: '#8a8a8e' },
    { id: 'midnight', name: 'Đêm', bg: '#0f172a', text: '#cbd5e1' },
    { id: 'coffee', name: 'Cà phê', bg: '#1c1814', text: '#d7c4b4' },
  ];

  const fonts: { id: FontType; name: string }[] = [
    { id: 'default', name: 'Không Chân (Sans)' },
    { id: 'palatino', name: 'Có Chân (Palatino)' },
    { id: 'bookerly', name: 'Sách (Bookerly)' },
    { id: 'font_viet_tay', name: 'Máy Tính (Mono)' },
  ];

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl p-4 space-y-4 transform-gpu transition-colors duration-200">
        <div className="w-10 h-1 rounded-full bg-outline-variant/50 mx-auto" />

        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
          <h3 className="text-sm font-extrabold text-on-surface flex items-center gap-1.5">
            <Type size={16} className="text-primary" /> Tùy Chỉnh Giao Diện Đọc
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Font Size A- / A+ Control */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider block">CỠ CHỮ: {fontSize}px</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="p-2.5 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary font-bold flex items-center gap-1 active:scale-95 shadow-sm"
            >
              <Minus size={14} /> A-
            </button>

            <input
              type="range"
              min="12"
              max="32"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 accent-primary bg-surface-container-highest h-2 rounded-lg cursor-pointer"
            />

            <button
              onClick={() => setFontSize(Math.min(36, fontSize + 1))}
              className="p-2.5 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary font-bold flex items-center gap-1 active:scale-95 shadow-sm"
            >
              <Plus size={14} /> A+
            </button>
          </div>
        </div>

        {/* Theme Palette Buttons */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider block flex items-center gap-1">
            <Palette size={12} className="text-primary" /> CHỦ ĐỀ MÀU NỀN
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 shadow-md font-extrabold'
                      : 'border-outline-variant/30 hover:border-outline-variant/60'
                  }`}
                  style={{ backgroundColor: t.bg, color: t.text }}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: t.bg }} />
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Family Selector */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-on-surface-variant/70 uppercase tracking-wider block">PHÔNG CHỮ SÁCH</span>
          <div className="grid grid-cols-2 gap-2">
            {fonts.map((f) => {
              const isSelected = font === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  className={`p-2.5 rounded-2xl border text-xs font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-on-primary border-primary shadow-md'
                      : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
