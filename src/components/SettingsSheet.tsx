import React from 'react';
import { X, Check, AlignJustify, AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { useReaderSettings, ThemeType, FontType } from '../contexts/ReaderContext';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, font, setFont, fontSize, setFontSize, lineHeight, setLineHeight, textAlign, setTextAlign } = useReaderSettings();

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-background text-on-background w-full max-w-reading-max-width rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto hide-scrollbar shadow-xl border border-surface-variant z-10 p-6 flex flex-col gap-6 pb-auto">
        
        <header className="flex justify-between items-center -mt-2">
          <div>
            <h1 className="font-headline-md text-on-surface">Cài đặt giao diện đọc</h1>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container rounded-full text-on-surface-variant hover:text-on-surface">
             <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="font-label-sm text-on-surface-variant uppercase tracking-widest">Màu nền</h2>
            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              <ThemeButton currentTheme={theme} targetTheme="default" bg="bg-[#1e1e1e]" ringColor="ring-primary" checkColor="text-white" label="Mặc định" onClick={() => setTheme('default')} />
              <ThemeButton currentTheme={theme} targetTheme="light" bg="bg-white" ringColor="ring-gray-300" checkColor="text-gray-900" label="Sáng" onClick={() => setTheme('light')} />
              <ThemeButton currentTheme={theme} targetTheme="paper" bg="bg-[#f4ecd8]" ringColor="ring-[#5c4d3c]" checkColor="text-[#5c4d3c]" label="Giấy" onClick={() => setTheme('paper')} />
              <ThemeButton currentTheme={theme} targetTheme="dark" bg="bg-[#050505]" ringColor="ring-gray-400" checkColor="text-white" label="Tối" onClick={() => setTheme('dark')} />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Phông chữ</h2>
            <div className="flex flex-col gap-1.5 sm:gap-2">
              <FontButton currentFont={font} targetFont="palatino" label="Palatino Linotype" onClick={() => setFont('palatino')} fontFamily="font-serif" />
              <FontButton currentFont={font} targetFont="bookerly" label="Bookerly" onClick={() => setFont('bookerly')} fontFamily="font-serif" />
              <FontButton currentFont={font} targetFont="minhphung" label="Minh Phụng" onClick={() => setFont('minhphung')} fontFamily="font-sans" />
              <FontButton currentFont={font} targetFont="default" label="Mặc định" onClick={() => setFont('default')} fontFamily="font-sans" />
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-5 sm:gap-6 bg-surface-container rounded-xl p-4 sm:p-6 border border-outline-variant/30 pb-safe">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Cỡ chữ</h2>
              <span className="text-xs font-semibold text-primary">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => setFontSize(Math.max(12, fontSize - 1))} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                A-
              </button>
              <input 
                type="range" min="14" max="32" step="1" 
                value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 accent-primary bg-surface-container-highest h-1 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
              />
              <button onClick={() => setFontSize(Math.min(32, fontSize + 1))} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-surface-container-highest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                A+
              </button>
            </div>
          </div>

          <hr className="border-outline-variant/20 -mx-4 sm:-mx-6" />

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="flex flex-col gap-3">
              <h2 className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Giãn dòng</h2>
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                <OptionButton active={lineHeight === 1.2} onClick={() => setLineHeight(1.2)}>1.2</OptionButton>
                <OptionButton active={lineHeight === 1.4} onClick={() => setLineHeight(1.4)}>1.4</OptionButton>
                <OptionButton active={lineHeight === 1.6} onClick={() => setLineHeight(1.6)}>1.6</OptionButton>
                <OptionButton active={lineHeight === 1.8} onClick={() => setLineHeight(1.8)}>1.8</OptionButton>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Căn lề</h2>
              <div className="flex bg-surface-container-highest rounded-lg p-1">
                <OptionButton active={textAlign === 'left'} onClick={() => setTextAlign('left')}>
                  <AlignLeft size={16} />
                </OptionButton>
                <OptionButton active={textAlign === 'right'} onClick={() => setTextAlign('right')}>
                  <AlignRight size={16} />
                </OptionButton>
                <OptionButton active={textAlign === 'justify'} onClick={() => setTextAlign('justify')}>
                  <AlignJustify size={16} />
                </OptionButton>
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
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${bg} flex items-center justify-center transition-transform shadow-sm ${active ? `ring-2 ring-offset-2 ring-offset-background ${ringColor} scale-105` : 'border border-outline-variant/50 group-hover:scale-105'}`}>
        <Check size={18} className={`${checkColor} transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      </div>
      <span className={`text-[10px] sm:text-xs font-semibold ${active ? 'text-primary' : 'text-on-surface-variant'}`}>{label}</span>
    </button>
  );
}

function FontButton({ currentFont, targetFont, label, onClick, fontFamily }: any) {
  const active = currentFont === targetFont;
  return (
    <button onClick={onClick} className={`flex justify-between items-center px-4 py-3 rounded-lg transition-colors border ${active ? 'bg-surface-container-high border-outline-variant/30' : 'bg-surface-container border-outline-variant/10 hover:bg-surface-container-high'}`}>
      <span className={`${fontFamily} text-sm ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>{label}</span>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-primary' : 'border-on-surface-variant'}`}>
        {active && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
    </button>
  );
}

function OptionButton({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex-1 py-1 sm:py-2 flex justify-center items-center rounded-md transition-colors ${active ? 'bg-surface-dim text-primary shadow-sm border border-outline-variant/10 font-bold' : 'text-on-surface-variant hover:bg-surface-bright font-medium'}`}
    >
      {children}
    </button>
  );
}

