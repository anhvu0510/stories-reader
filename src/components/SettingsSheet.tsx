import React from 'react';
import { X, Check, AlignJustify, AlignCenter, AlignLeft, AlignRight, Layers } from 'lucide-react';
import { useReaderSettings, ThemeType, FontType } from '../contexts/ReaderContext';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, font, setFont, fontSize, setFontSize, lineHeight, setLineHeight, groupLines, setGroupLines } = useReaderSettings();

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-surface-container text-on-surface w-full max-w-[680px] rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto hide-scrollbar shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-10 p-5 sm:p-6 flex flex-col gap-6 pb-safe border-t sm:border border-outline-variant/30">
        
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-outline-variant/40 rounded-full mx-auto mb-2 sm:hidden" />

        <header className="flex justify-between items-center -mt-2">
          <div>
            <h1 className="text-lg font-bold text-on-surface">Cài đặt giao diện</h1>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container-high rounded-full text-on-surface-variant hover:text-on-surface active:scale-95 transition-all">
             <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Màu nền</h2>
            <div className="grid grid-cols-6 gap-2">
              <ThemeButton currentTheme={theme} targetTheme="default" bg="bg-[#1e1e1e]" ringColor="ring-primary" checkColor="text-white" label="Mặc định" onClick={() => setTheme('default')} />
              <ThemeButton currentTheme={theme} targetTheme="modern-vn" bg="bg-[#0b1326]" ringColor="ring-orange-400" checkColor="text-[#dae2fd]" label="Modern" onClick={() => setTheme('modern-vn')} />
              <ThemeButton currentTheme={theme} targetTheme="amoled" bg="bg-[#000000]" ringColor="ring-gray-500" checkColor="text-[#8a8a8e]" label="Amoled" onClick={() => setTheme('amoled')} />
              <ThemeButton currentTheme={theme} targetTheme="midnight" bg="bg-[#0f172a]" ringColor="ring-blue-500" checkColor="text-[#cbd5e1]" label="Midnight" onClick={() => setTheme('midnight')} />
              <ThemeButton currentTheme={theme} targetTheme="obsidian" bg="bg-[#0d0d12]" ringColor="ring-purple-500" checkColor="text-[#a1a1aa]" label="Obsidian" onClick={() => setTheme('obsidian')} />
              <ThemeButton currentTheme={theme} targetTheme="coffee" bg="bg-[#1c1814]" ringColor="ring-orange-900" checkColor="text-[#d7c4b4]" label="Coffee" onClick={() => setTheme('coffee')} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Phông chữ</h2>
            <div className="grid grid-cols-2 gap-2">
              <FontButton currentFont={font} targetFont="palatino" label="Palatino" onClick={() => setFont('palatino')} fontFamily="font-serif" />
              <FontButton currentFont={font} targetFont="bookerly" label="Bookerly" onClick={() => setFont('bookerly')} fontFamily="font-serif" />
              <FontButton currentFont={font} targetFont="font_viet_tay" label="Viết tay" onClick={() => setFont('font_viet_tay')} fontFamily='"Patrick Hand", cursive' />
              <FontButton currentFont={font} targetFont="default" label="Mặc định" onClick={() => setFont('default')} fontFamily="font-sans" />
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-5 sm:gap-6 bg-surface-container rounded-2xl p-5 border border-outline-variant/30">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Cỡ chữ</h2>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                A-
              </button>
              <input 
                type="range" min="14" max="32" step="1" 
                value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 accent-primary h-1.5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full cursor-pointer bg-surface-container-highest"
              />
              <button onClick={() => setFontSize(Math.min(32, fontSize + 1))} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                A+
              </button>
            </div>
          </div>

          <hr className="border-outline-variant/10 -mx-5" />

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-3">
              <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Giãn dòng</h2>
              <div className="flex bg-surface-container-highest rounded-xl p-1 gap-1">
                <OptionButton active={lineHeight === 1.2} onClick={() => setLineHeight(1.2)}>1.2</OptionButton>
                <OptionButton active={lineHeight === 1.4} onClick={() => setLineHeight(1.4)}>1.4</OptionButton>
                <OptionButton active={lineHeight === 1.6} onClick={() => setLineHeight(1.6)}>1.6</OptionButton>
                <OptionButton active={lineHeight === 1.8} onClick={() => setLineHeight(1.8)}>1.8</OptionButton>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Gộp dòng (Đoạn)</h2>
              <div className="flex bg-surface-container-highest rounded-xl p-1 items-center gap-1">
                 <button onClick={() => setGroupLines(Math.max(1, groupLines - 1))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                  -
                 </button>
                 <div className="flex-1 text-center font-bold text-sm text-primary flex items-center justify-center gap-1.5">
                   <Layers size={14} className="opacity-70" />
                   {groupLines}
                 </div>
                 <button onClick={() => setGroupLines(Math.min(10, groupLines + 1))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                  +
                 </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeButton({ currentTheme, targetTheme, bg, ringColor, checkColor, label, onClick }: any) {
  const active = currentTheme === targetTheme;
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group outline-none">
      <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center transition-all duration-300 shadow-sm ${active ? `ring-2 ring-offset-2 ring-offset-surface ${ringColor} scale-105` : 'border border-outline-variant/30 group-hover:scale-105'}`}>
        <Check size={20} className={`${checkColor} transition-transform duration-300 ${active ? 'scale-100 opacity-100' : 'scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-50'}`} />
      </div>
      <span className={`text-[11px] font-bold transition-colors ${active ? 'text-primary' : 'text-on-surface-variant'}`}>{label}</span>
    </button>
  );
}

function FontButton({ currentFont, targetFont, label, onClick, fontFamily }: any) {
  const active = currentFont === targetFont;
  return (
    <button onClick={onClick} className={`flex justify-center items-center px-2 py-2.5 rounded-xl transition-all outline-none ${active ? 'bg-primary/10 text-primary font-bold' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-bright font-medium'}`}>
      <span className={`${fontFamily} text-sm line-clamp-1`}>{label}</span>
    </button>
  );
}

function OptionButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-2 flex justify-center items-center rounded-lg transition-all outline-none ${active ? 'bg-background text-primary shadow-sm font-bold scale-100' : 'text-on-surface-variant hover:bg-surface hover:text-on-surface font-medium scale-95 hover:scale-100'}`}
    >
      {children}
    </button>
  );
}

