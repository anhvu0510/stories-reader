import React from 'react';
import { Palette, Type, Sliders, Layers, Plus, Minus, BookOpen, Volume2, RefreshCw } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { ThemeType, FontType } from '../../../shared/types';
import { motion } from 'motion/react';
import { triggerHaptic } from '../../../hooks/useHaptic';

const THEMES: { id: ThemeType; label: string; bg: string; color: string }[] = [
  { id: 'royal-vn', label: 'Royal VN', bg: '#040e2b', color: '#e2e8f0' },
  { id: 'default', label: 'Amoled', bg: '#000000', color: '#f4f4f5' },
  { id: 'midnight', label: 'Midnight', bg: '#0f172a', color: '#f8fafc' },
  { id: 'obsidian', label: 'Obsidian', bg: '#0c0a14', color: '#f3e8ff' },
];

const FONTS: { id: FontType; label: string }[] = [
  { id: 'default', label: 'Mặc định' },
  { id: 'palatino', label: 'Palatino' },
  { id: 'bookerly', label: 'Bookerly' },
  { id: 'font_viet_tay', label: 'Viết Tay' },
];

interface StepperProps {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  onChange: (val: number) => void;
}

function NumericStepper({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
}: StepperProps) {
  const displayVal = formatValue ? formatValue(value) : `${value}${unit ? ` ${unit}` : ''}`;
  const canDecrease = value > min;
  const canIncrease = value < max;

  const handleDecrease = () => {
    if (canDecrease) {
      const next = Math.max(min, Number((value - step).toFixed(2)));
      onChange(next);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      const next = Math.min(max, Number((value + step).toFixed(2)));
      onChange(next);
    }
  };

  return (
    <div className="p-2 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between gap-1.5 shadow-xs">
      <label className="text-xs font-bold text-on-surface flex items-center gap-1 min-w-0 leading-tight">
        {icon}
        <span className="truncate">{label}</span>
      </label>

      <div className="flex items-center justify-between gap-1 bg-white/10 p-1 rounded-xl border border-white/15 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.2)]">
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            triggerHaptic('light');
            handleDecrease();
          }}
          disabled={!canDecrease}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface flex items-center justify-center transition-all font-bold shrink-0 cursor-pointer"
          title="Giảm"
        >
          <Minus size={13} />
        </motion.button>

        <span className="px-1 text-xs font-mono font-extrabold text-primary text-center select-none truncate flex-1">
          {displayVal}
        </span>

        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={() => {
            triggerHaptic('light');
            handleIncrease();
          }}
          disabled={!canIncrease}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-on-surface flex items-center justify-center transition-all font-bold shrink-0 cursor-pointer"
          title="Tăng"
        >
          <Plus size={13} />
        </motion.button>
      </div>
    </div>
  );
}

export function ReaderSettingsTab() {
  const {
    theme, setTheme,
    font, setFont,
    fontSize, setFontSize,
    lineHeight, setLineHeight,
    groupLines, setGroupLines,
    batchChapterSize, setBatchChapterSize,
    isEnabledReplace, setIsEnabledReplace,
    showTTSControlOnReader = true, setShowTTSControlOnReader,
    bookLimit, setBookLimit,
    chapterLimit, setChapterLimit,
  } = useReaderConfigStore();

  return (
    <div className="space-y-3 text-on-surface">
      {/* Top Controls: Compact Toggle Chips with Icons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Toggle Nút Đọc TTS */}
        <div className="p-2.5 px-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-1.5 shadow-xs">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 min-w-0">
            <Volume2 size={14} className="text-primary shrink-0" />
            <span className="truncate">Nút Đọc</span>
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              triggerHaptic('selection');
              setShowTTSControlOnReader(!showTTSControlOnReader);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
              showTTSControlOnReader ? 'bg-primary' : 'bg-white/20'
            }`}
            title={showTTSControlOnReader ? 'Tắt nút Đọc ngoài màn hình' : 'Bật nút Đọc ngoài màn hình'}
            aria-label="Chuyển đổi hiển thị nút Đọc ngoài màn hình"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                showTTSControlOnReader ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </motion.button>
        </div>

        {/* Toggle Từ điển thay thế */}
        <div className="p-2.5 px-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-1.5 shadow-xs">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 min-w-0">
            <RefreshCw size={14} className="text-primary shrink-0" />
            <span className="truncate">Thay thế từ</span>
          </span>
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              triggerHaptic('selection');
              setIsEnabledReplace(!isEnabledReplace);
            }}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
              isEnabledReplace ? 'bg-primary' : 'bg-white/20'
            }`}
            title={isEnabledReplace ? 'Tắt thay thế từ' : 'Bật thay thế từ'}
            aria-label="Chuyển đổi từ điển thay thế"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                isEnabledReplace ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </motion.button>
        </div>
      </div>
      {/* Themes (2 cột) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            <Palette size={13} className="text-primary" /> Theme
          </span>
          <span className="text-[10px] font-mono text-primary font-bold uppercase">
            {THEMES.find((t) => t.id === theme)?.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((item) => {
            const isSelected = theme === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  triggerHaptic('selection');
                  setTheme(item.id);
                }}
                className={`py-2 px-3 rounded-xl border flex items-center gap-2 transition-all text-xs cursor-pointer ${
                  isSelected
                    ? 'bg-primary/20 hover:bg-primary/25 border-primary/50 text-primary font-black shadow-xs'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-xs"
                  style={{ backgroundColor: item.bg }}
                />
                <span className="font-bold text-xs truncate">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Fonts (2 cột) */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Type size={13} className="text-primary" />
          <span className="text-xs font-bold text-on-surface">Phông chữ</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((item) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                triggerHaptic('selection');
                setFont(item.id);
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center truncate cursor-pointer ${
                font === item.id
                  ? 'bg-primary/20 hover:bg-primary/25 border-primary/50 text-primary font-black shadow-xs'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface'
              }`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Numeric Steppers (2 cột) */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sliders size={13} className="text-primary" />
          <span className="text-xs font-bold text-on-surface">Thông số đọc</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Cỡ chữ */}
          <NumericStepper
            label="Cỡ chữ"
            icon={<Type size={12} className="text-primary" />}
            value={fontSize}
            min={12}
            max={36}
            step={1}
            unit="px"
            onChange={setFontSize}
          />

          {/* Khoảng cách dòng */}
          <NumericStepper
            label="Giãn dòng"
            icon={<Sliders size={12} className="text-primary" />}
            value={lineHeight}
            min={1.0}
            max={2.4}
            step={0.1}
            onChange={setLineHeight}
          />

          {/* Gộp dòng */}
          <NumericStepper
            label="Gộp đoạn"
            icon={<Layers size={12} className="text-primary" />}
            value={groupLines}
            min={1}
            max={10}
            step={1}
            unit="dòng"
            onChange={setGroupLines}
          />

          {/* Số chương gộp */}
          <NumericStepper
            label="Gộp chương"
            icon={<Sliders size={12} className="text-primary" />}
            value={batchChapterSize || 1}
            min={1}
            max={20}
            step={1}
            unit="chương"
            onChange={setBatchChapterSize}
          />

          {/* Giới hạn Sách */}
          <NumericStepper
            label="Sách / trang"
            icon={<BookOpen size={12} className="text-primary" />}
            value={bookLimit || 20}
            min={5}
            max={100}
            step={5}
            unit="sách"
            onChange={setBookLimit}
          />

          {/* Giới hạn Chương */}
          <NumericStepper
            label="Chương / trang"
            icon={<Sliders size={12} className="text-primary" />}
            value={chapterLimit || 50}
            min={10}
            max={200}
            step={10}
            unit="chương"
            onChange={setChapterLimit}
          />
        </div>
      </div>
    </div>
  );
}
