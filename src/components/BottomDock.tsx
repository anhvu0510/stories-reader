import { Home, Clock, Sparkles, Settings, Globe, Trash2 } from 'lucide-react';



export function BottomDock({
  activeTab,
  onTabSelect,
  isOfflineMode,
  onClearDbClick
}: {
  activeTab: 'books' | 'history' | 'ai',
  onTabSelect: (tab: 'books' | 'history' | 'ai') => void,
  isOfflineMode?: boolean,
  onClearDbClick?: () => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] pointer-events-none drop-shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
      <div className="flex justify-center w-full mt-4">
        <div className="relative flex items-center justify-around px-6 h-[64px] mx-auto w-full pointer-events-auto">

          {/* Advanced Curved Background (SVG) */}
          <div className="absolute inset-x-0 bottom-0 w-full h-[55px] -z-10">
            {/* The SVG acts as the base */}
            <svg width="100%" height="100%" viewBox="0 0 375 64" preserveAspectRatio="none" className="absolute inset-0 w-full h-full drop-shadow-sm style-nav-bg">
              {/* Solid backdrop */}
              <path
                d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24 V64 H0 V24 Z"
                className="nav-bg-fill"
              />
              {/* Full top border spanning the curve and rounded edges */}
              <path
                d="M0 24 C0 10.745 10.745 0 24 0 H130 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0 H351 C364.255 0 375 10.745 375 24"
                fill="none"
                className="stroke-outline-variant/30"
                strokeWidth="1.5"
              />
              {/* Center highlight over the curve */}
              <path
                d="M130 0 C138 0 144 6 148 14 C154 32 165 42 187.5 42 C210 42 221 32 227 14 C231 6 237 0 245 0"
                fill="none"
                className="stroke-primary/40"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Left item: Dịch AI or Delete DB */}
          {isOfflineMode ? (
            <button
              onClick={onClearDbClick}
              className="relative flex items-center justify-center w-16 h-[64px] transition-all duration-300"
              title="Xóa toàn bộ dữ liệu Offline"
            >
              <div className="transition-all duration-300 text-error/80 hover:text-error hover:scale-110">
                <Trash2 size={24} strokeWidth={2} />
              </div>
            </button>
          ) : (
            <button
              onClick={() => onTabSelect('ai')}
              className="relative flex items-center justify-center w-16 h-[64px] transition-all duration-300"
            >
              <div className={`transition-all duration-300 ${activeTab === 'ai' ? 'text-primary scale-110 drop-shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <Sparkles size={24} strokeWidth={activeTab === 'ai' ? 2.5 : 2} />
              </div>
            </button>
          )}

          {/* Center item: Home (Floating) */}
          <div className="relative flex flex-col items-center -mt-8 mb-[10px]">
            <button
              onClick={() => onTabSelect('books')}
              className={`relative flex items-center justify-center w-[40px] h-[40px] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-95 ${activeTab === 'books'
                ? 'bg-primary text-on-primary scale-105'
                : 'bg-surface-container-highest text-on-surface hover:bg-surface-container'
                }`}
              title="Thư viện"
            >
              {/* Rings */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent ring-1 ring-primary/20 ring-offset-2 ring-offset-surface"></div>
              <div className="absolute inset-[-4px] rounded-full ring-1 ring-outline-variant/20"></div>
              <Home size={26} strokeWidth={activeTab === 'books' ? 2.5 : 2} className={activeTab === 'books' ? 'drop-shadow-sm' : ''} />
            </button>
          </div>

          {/* Right item: Lịch sử */}
          <button
            onClick={() => onTabSelect('history')}
            className="relative flex items-center justify-center w-16 h-[64px] transition-all duration-300"
          >
            <div className={`transition-all duration-300 ${activeTab === 'history' ? 'text-primary scale-110 drop-shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <Clock size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            </div>
          </button>

        </div>
      </div>
    </nav>
  );
}
