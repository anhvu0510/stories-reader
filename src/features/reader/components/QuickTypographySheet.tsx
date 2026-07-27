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

  const fonts: { id: FontType; name: string; sample: string }[] = [
    { id: 'bookerly', name: 'Bookerly', sample: 'Sách Kindle' },
    { id: 'merriweather', name: 'Merriweather', sample: 'Êm mắt' },
    { id: 'lora', name: 'Lora', sample: 'Nghệ thuật' },
    { id: 'charter', name: 'Charter', sample: 'Cổ điển' },
    { id: 'palatino', name: 'Palatino', sample: 'Có chân' },
    { id: 'default', name: 'Sans-Serif', sample: 'Không chân' },
    { id: 'font_viet_tay', name: 'Monospace', sample: 'Máy tính' },
  ];

  const lineHeights = [
    { val: 1.2, label: '1.2 Chặt' },
    { val: 1.4, label: '1.4 Tiêu chuẩn' },
    { val: 1.6, label: '1.6 Rộng' },
    { val: 1.8, label: '1.8 Thoáng' },
  ];

  const lineGroups = [
    { val: 1, label: '1 dòng (Đơn)' },
    { val: 2, label: '2 dòng (Gộp đôi)' },
    { val: 3, label: '3 dòng (Gộp ba)' },
  ];

  const currentThemeObj = themes.find((t) => t.id === theme) || themes[0];

  return (
    <div className="fixed inset-0 z-[95000] bg-black/80 flex justify-center items-end p-0 overflow-x-hidden box-border">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Mobile Bottom Sheet Content */}
      <div className="relative z-10 bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] border-t border-outline-variant/30 shadow-2xl p-4 sm:p-5 space-y-3.5 max-h-[85dvh] overflow-y-auto hide-scrollbar transform-gpu transition-all duration-200 box-border">
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-outline-variant/50 mx-auto mb-3" />
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
            <h3 className="text-sm font-black text-on-surface flex items-center gap-2 tracking-tight">
              <Type size={16} className="text-primary" /> Cấu Hình Chế Độ Đọc
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors active:scale-95"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 1. Font Size Control */}
        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1">
              <Type size={12} className="text-primary" /> CỠ CHỮ SÁCH
            </span>
            <span className="text-xs font-mono font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
              {fontSize}px
            </span>
          </div>

          <div className="flex items-center gap-2.5 pt-0.5">
            <button
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="p-2 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary font-bold flex items-center gap-1 active:scale-95 shadow-xs shrink-0"
              title="Giảm cỡ chữ"
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
              className="p-2 rounded-xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:text-primary font-bold flex items-center gap-1 active:scale-95 shadow-xs shrink-0"
              title="Tăng cỡ chữ"
            >
              <Plus size={14} /> A+
            </button>
          </div>
        </div>

        {/* 2. Compact Color Circle Swatches */}
        <div className="bg-surface-container-low p-2.5 px-3 rounded-2xl border border-outline-variant/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Palette size={13} className="text-primary" />
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
              MÀU NỀN: <span className="text-primary font-extrabold">{currentThemeObj.name}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1 px-1">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-black/20 transition-all active:scale-90 relative ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110 shadow-md'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: t.bg, color: t.text }}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Expanded Font Family Selector */}
        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 space-y-2">
          <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider block">
            PHÔNG CHỮ ĐỌC SÁCH
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {fonts.map((f) => {
              const isSelected = font === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  className={`p-2 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary shadow-xs font-extrabold'
                      : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold truncate">{f.name}</span>
                    {isSelected && <Check size={12} className="text-primary shrink-0 ml-0.5" />}
                  </div>
                  <span className="text-[9px] font-mono opacity-70 mt-0.5">{f.sample}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Line Height / Giãn dòng */}
        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 space-y-2">
          <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider block flex items-center gap-1">
            <AlignJustify size={12} className="text-primary" /> GIÃN DÒNG (LINE HEIGHT)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {lineHeights.map((lh) => {
              const isSelected = Math.abs(lineHeight - lh.val) < 0.05;
              return (
                <button
                  key={lh.val}
                  onClick={() => setLineHeight(lh.val)}
                  className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-on-primary border-primary shadow-xs font-extrabold'
                      : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {lh.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Group Lines / Khoảng cách gộp đoạn */}
        <div className="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/20 space-y-2">
          <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider block flex items-center gap-1">
            <Layers size={12} className="text-primary" /> BỐ CỤC GỘP ĐOẠN
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {lineGroups.map((lg) => {
              const isSelected = groupLines === lg.val;
              return (
                <button
                  key={lg.val}
                  onClick={() => setGroupLines(lg.val)}
                  className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-on-primary border-primary shadow-xs font-extrabold'
                      : 'bg-surface-container-high border-outline-variant/30 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {lg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. Utility Toggle: Replace Words */}
        <div className="bg-surface-container-low p-2.5 px-3 rounded-2xl border border-outline-variant/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders size={15} className="text-primary shrink-0" />
            <div>
              <p className="text-xs font-bold text-on-surface">Bộ Thay Thế Từ Ngữ</p>
              <p className="text-[9px] text-on-surface-variant/70 font-mono">Tự động áp dụng từ điển thay thế</p>
            </div>
          </div>

          <button
            onClick={() => setIsEnabledReplace(!isEnabledReplace)}
            className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
              isEnabledReplace ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/40'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out shadow-sm ${
                isEnabledReplace ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
