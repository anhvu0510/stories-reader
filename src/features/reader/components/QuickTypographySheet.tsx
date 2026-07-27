import React from 'react';
import { X, Type, Minus, Plus, Palette, AlignJustify, Layers, Sliders, Check } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { FontType, ThemeType } from '../../../shared/types';

interface QuickTypographySheetProps {
  onClose: () => void;
}

export function QuickTypographySheet({ onClose }: QuickTypographySheetProps) {
  const {
    fontSize, setFontSize,
    lineHeight, setLineHeight,
    groupLines, setGroupLines,
    theme, setTheme,
    font, setFont,
    isEnabledReplace, setIsEnabledReplace,
  } = useReaderConfigStore();

  const themes: { id: ThemeType; name: string; bg: string; text: string }[] = [
    { id: 'default', name: 'Tối', bg: '#09090b', text: '#f4f4f5' },
    { id: 'sepia', name: 'Sepia', bg: '#fef3c7', text: '#78350f' },
    { id: 'amoled', name: 'Đen', bg: '#000000', text: '#8a8a8e' },
    { id: 'midnight', name: 'Đêm', bg: '#0f172a', text: '#cbd5e1' },
    { id: 'coffee', name: 'Cà phê', bg: '#1c1814', text: '#d7c4b4' },
    { id: 'obsidian', name: 'Đá núi', bg: '#121316', text: '#e2e8f0' },
  ];

  const fonts: { id: FontType; name: string }[] = [
    { id: 'bookerly', name: 'Bookerly' },
    { id: 'merriweather', name: 'Merriweather' },
    { id: 'lora', name: 'Lora' },
    { id: 'charter', name: 'Charter' },
    { id: 'palatino', name: 'Palatino' },
    { id: 'default', name: 'Sans-Serif' },
    { id: 'font_viet_tay', name: 'Monospace' },
  ];

  const lineHeights = [
    { val: 1.2, label: '1.2 Chặt' },
    { val: 1.4, label: '1.4 Chuẩn' },
    { val: 1.6, label: '1.6 Rộng' },
    { val: 1.8, label: '1.8 Thoáng' },
  ];

  const lineGroups = [
    { val: 1, label: '1 dòng' },
    { val: 2, label: 'Gộp 2' },
    { val: 3, label: 'Gộp 3' },
  ];

  const currentThemeObj = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="fixed inset-0 z-[95000] bg-black/70 flex justify-center items-end p-0 overflow-x-hidden box-border">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Ultra-Compact Mobile Bottom Sheet (~340px Max Height) */}
      <div className="relative z-10 bg-surface-container/95 backdrop-blur-xl text-on-surface w-full max-w-md mx-auto rounded-t-[24px] border-t border-outline-variant/30 shadow-2xl p-3.5 sm:p-4 space-y-3 max-h-[50dvh] overflow-y-auto hide-scrollbar transform-gpu transition-all duration-200 box-border">
        {/* Header & Drag Handle */}
        <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20">
          <div className="flex items-center gap-1.5">
            <Type size={15} className="text-primary" />
            <h3 className="text-xs font-black tracking-tight text-on-surface uppercase font-mono">
              Giao Diện Đọc ({fontSize}px)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
          >
            <X size={15} />
          </button>
        </div>

        {/* Row 1: Font Size Controls */}
        <div className="flex items-center justify-between gap-2 bg-surface-container-low p-2 px-3 rounded-xl border border-outline-variant/20">
          <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
            <Type size={11} className="text-primary" /> CỠ CHỮ: <span className="text-primary font-black">{fontSize}px</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="px-2 py-1 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold text-xs active:scale-95 shadow-xs"
              title="Giảm cỡ chữ"
            >
              <Minus size={12} /> A-
            </button>
            <input
              type="range"
              min="12"
              max="32"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 accent-primary bg-surface-container-highest h-1.5 rounded-lg cursor-pointer"
            />
            <button
              onClick={() => setFontSize(Math.min(36, fontSize + 1))}
              className="px-2 py-1 rounded-lg bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold text-xs active:scale-95 shadow-xs"
              title="Tăng cỡ chữ"
            >
              <Plus size={12} /> A+
            </button>
          </div>
        </div>

        {/* Row 2: Super-Slim Color Swatches */}
        <div className="flex items-center justify-between gap-2 bg-surface-container-low p-1.5 px-3 rounded-xl border border-outline-variant/20">
          <div className="flex items-center gap-1 shrink-0">
            <Palette size={11} className="text-primary" />
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
              MÀU NỀN: <span className="text-primary font-black">{currentThemeObj.name}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5 px-1">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-black/20 transition-all active:scale-90 relative ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface scale-110 shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: t.bg, color: t.text }}
                >
                  {isSelected && <Check size={10} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Horizontal Scrolling Font Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
          {fonts.map((f) => {
            const isSelected = font === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFont(f.id)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 transition-all active:scale-95 flex items-center gap-1 ${
                  isSelected
                    ? 'bg-primary text-on-primary border-primary shadow-xs font-extrabold'
                    : 'bg-surface-container-low border-outline-variant/25 text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f.name}
                {isSelected && <Check size={11} strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        {/* Row 3: Line Height (Left) & Group Lines (Right) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Line Height */}
          <div className="bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20 space-y-1">
            <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider block px-1 flex items-center gap-1">
              <AlignJustify size={10} className="text-primary" /> GIÃN DÒNG
            </span>
            <div className="grid grid-cols-4 gap-1">
              {lineHeights.map((lh) => {
                const isSelected = Math.abs(lineHeight - lh.val) < 0.05;
                return (
                  <button
                    key={lh.val}
                    onClick={() => setLineHeight(lh.val)}
                    className={`py-1 rounded-lg border text-[10px] font-bold text-center transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary font-black'
                        : 'bg-surface-container border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    {lh.val}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Lines */}
          <div className="bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20 space-y-1">
            <span className="text-[9px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider block px-1 flex items-center gap-1">
              <Layers size={10} className="text-primary" /> GỘP ĐOẠN
            </span>
            <div className="grid grid-cols-3 gap-1">
              {lineGroups.map((lg) => {
                const isSelected = groupLines === lg.val;
                return (
                  <button
                    key={lg.val}
                    onClick={() => setGroupLines(lg.val)}
                    className={`py-1 rounded-lg border text-[10px] font-bold text-center transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-primary text-on-primary border-primary font-black'
                        : 'bg-surface-container border-outline-variant/20 text-on-surface-variant'
                    }`}
                  >
                    {lg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 4: Utility Toggle Switch (Word Replacement) */}
        <div className="bg-surface-container-low p-2 px-3 rounded-xl border border-outline-variant/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sliders size={13} className="text-primary shrink-0" />
            <span className="text-xs font-bold text-on-surface">Bộ Thay Thế Từ Ngữ</span>
          </div>

          <button
            onClick={() => setIsEnabledReplace(!isEnabledReplace)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 ${
              isEnabledReplace ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-xs ${
                isEnabledReplace ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
