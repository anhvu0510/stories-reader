import React, { useState, useEffect } from 'react';
import { X, Edit3, Search, Trash2, ArrowRight, Save, Filter, Settings, Globe, Check, Layers, MonitorSmartphone, ChevronDown, ChevronUp, Volume2, KeyRound, Server, Plus, RefreshCw, BookOpen, List, Bot } from 'lucide-react';
import { api, Replacement, ApiDomain, getApiDomains } from '../lib/api';
import { useReaderSettings } from '../contexts/ReaderContext';

import { QuotaSettingsSheet } from './QuotaSettingsSheet';
import { TokenManagerSheet } from './TokenManagerSheet';
import { OfflineManagerSheet } from './OfflineManagerSheet';
import { cn } from '../lib/utils';
import { showToast } from './Toast';

type RealScope = 'chapter' | 'book' | 'global';

interface GlobalSettingsSheetProps {
  onClose: () => void;
  initialMatch?: string;
  initialTab?: 'api' | 'names' | 'voice' | 'ai' | 'servers';
  currentBookId?: string;
  currentChapterId?: string;
  isOfflineMode?: boolean;
}

export function GlobalSettingsSheet({ onClose, initialMatch = '', initialTab, currentBookId, currentChapterId, isOfflineMode = false }: GlobalSettingsSheetProps) {
  const { 
    isEnabledReplace, setIsEnabledReplace,
    theme, setTheme, font, setFont, fontSize, setFontSize, lineHeight, setLineHeight, groupLines, setGroupLines,
    speechRate, setSpeechRate, bookLimit, setBookLimit, chapterLimit, setChapterLimit
  } = useReaderSettings();
  const [activeTab, setActiveTab] = useState<'api' | 'names' | 'voice' | 'ai' | 'servers'>(initialTab || (initialMatch ? 'names' : 'api'));

  useEffect(() => {
    if (isOfflineMode && (activeTab === 'ai' || activeTab === 'names')) {
      setActiveTab('api');
    }
  }, [isOfflineMode, activeTab]);

  const [aiSubTab, setAiSubTab] = useState<'tokens' | 'models'>('tokens');

  // Names State
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<RealScope | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [matchStr, setMatchStr] = useState(initialMatch);
  const [replacementStr, setReplacementStr] = useState('');
  const [scope, setScope] = useState<RealScope>('chapter');

  // API State
  const [apiDomains, setApiDomains] = useState<ApiDomain[]>([]);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [domainName, setDomainName] = useState('');
  const [domainUrl, setDomainUrl] = useState('');

  useEffect(() => {
    let sortedDomains = getApiDomains();
    setApiDomains(sortedDomains);
    setActiveDomainId(localStorage.getItem('ACTIVE_API_DOMAIN_ID'));
  }, []);

  const [testingDomainId, setTestingDomainId] = useState<string | null>(null);
  const [isFetchingDomains, setIsFetchingDomains] = useState(false);

  const handleFetchDomainsFromAPI = async () => {
    setIsFetchingDomains(true);
    try {
      const dataAPI = await api.getSettings('stories.ui.domain', true);
      const data = dataAPI?.value ?? [];

      if (Array.isArray(data)) {
        const fetchedDomains: ApiDomain[] = data.map((item: any) => ({
          id: String(item.id),
          name: item.name || '',
          url: item.url || ''
        }));

        let newDomains: ApiDomain[] = [];
        if (apiDomains.length > 0) {
          newDomains.push(apiDomains[0]);
        }

        for (const fd of fetchedDomains) {
          if (fd.id && fd.url && fd.id !== newDomains[0]?.id) {
            newDomains.push(fd);
          }
        }

        setApiDomains(newDomains);
        localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify(newDomains));
        showToast('Đã tải và cập nhật danh sách máy chủ', 'success');
      } else {
        showToast('Dữ liệu máy chủ không hợp lệ', 'error');
      }
    } catch (error) {
      showToast('Lỗi khi tải danh sách máy chủ', 'error');
    } finally {
      setIsFetchingDomains(false);
    }
  };

  const handleSelectActiveDomain = async (id: string | null) => {
    if (!id) {
      setActiveDomainId(null);
      localStorage.removeItem('ACTIVE_API_DOMAIN_ID');
      return;
    }

    const domain = apiDomains.find(d => d.id === id);
    if (!domain) return;

    setTestingDomainId(id);
    try {
      const isOk = await api.testConnection(domain.url);
      if (isOk) {
        setActiveDomainId(id);
        localStorage.setItem('ACTIVE_API_DOMAIN_ID', id);
        showToast(`Đã kết nối với máy chủ`, 'success');
        window.location.reload();
      } else {
        showToast(`Không thể kết nối đến máy chủ`, 'error');
      }
    } catch {
      showToast(`Không thể kết nối đến máy chủ`, 'error');
    } finally {
      setTestingDomainId(null);
    }
  };

  useEffect(() => {
    if (initialMatch) {
      setMatchStr(initialMatch);
      setActiveTab('names');
    }
  }, [initialMatch]);

  useEffect(() => {
    setLoading(true);
    api.getReplacements(currentBookId, currentChapterId).then(res => {
      setReplacements(res.data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [currentBookId, currentChapterId]);

  const handleSaveName = async () => {
    if (!matchStr.trim() || !replacementStr.trim()) return;

    try {
      const data: Partial<Replacement> = {
        match: matchStr,
        replacement: replacementStr,
        scope,
        bookId: currentBookId,
        chapterId: currentChapterId
      };
      
      if (editingId) {
        data.id = editingId;
        const updated = await api.saveReplacement(data);
        setReplacements(prev => prev.map(r => r.id === editingId ? updated : r));
      } else {
        const created = await api.saveReplacement(data);
        setReplacements(prev => [created, ...prev]);
      }

      setEditingId(null);
      setMatchStr('');
      setReplacementStr('');
    } catch (e) {
      console.error("Failed to save replacement", e);
    }
  };

  const handleEdit = (r: Replacement) => {
    setEditingId(r.id);
    setMatchStr(r.match);
    setReplacementStr(r.replacement);
    setScope(r.scope);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteReplacement(id);
      setReplacements(prev => prev.filter(r => r.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setMatchStr('');
        setReplacementStr('');
      }
    } catch (err) {
      console.error("Failed to delete replacement", err);
    }
  };

  const handleSaveDomain = async () => {
    if (!domainUrl.trim()) return;
    
    let finalDomainName = domainName.trim() || 'Server Mặc định';
    
    // Check server info
    try {
      const res = await fetch(`${domainUrl.trim()}/api/stories/setting/stories.ui.domain`);
      if (res.ok) {
        const data = await res.json();
        const serverName = typeof data === 'string' ? data : (data?.name || data?.value || data?.title);
        if (serverName && typeof serverName === 'string' && !domainName.trim()) {
          finalDomainName = serverName;
        }
      } else {
        // If domain setting API isn't active, fail the submission!
        showToast('Máy chủ không phản hồi hoặc URL không hợp lệ.', 'error');
        return;
      }
    } catch (e) {
      showToast('Máy chủ không phản hồi hoặc URL không hợp lệ.', 'error');
      return;
    }

    let newDomains = [...apiDomains];
    if (editingDomainId) {
      newDomains = newDomains.map(d => d.id === editingDomainId ? { ...d, name: finalDomainName, url: domainUrl } : d);
    } else {
      newDomains.push({
        id: Date.now().toString(),
        name: finalDomainName,
        url: domainUrl
      });
    }
    
    setApiDomains(newDomains);
    localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify(newDomains));
    
    setShowDomainForm(false);
    setEditingDomainId(null);
    setDomainName('');
    setDomainUrl('');
  };
  
  const handleEditDomain = (domain: ApiDomain) => {
    setEditingDomainId(domain.id);
    setDomainName(domain.name);
    setDomainUrl(domain.url);
    setShowDomainForm(true);
  };
  
  const handleDeleteDomain = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newDomains = apiDomains.filter(d => d.id !== id);
    setApiDomains(newDomains);
    localStorage.setItem('API_DOMAINS_CONFIG', JSON.stringify(newDomains));
  };

  const filteredReplacements = replacements.filter(r => {
    const matchesSearch = r.match.toLowerCase().includes(searchQuery.toLowerCase()) || r.replacement.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScope = filterScope === 'all' || r.scope === filterScope;
    return matchesSearch && matchesScope;
  });

  const getScopeLabel = (s: RealScope) => {
    if (s === 'chapter') return 'Chương';
    if (s === 'book') return 'Truyện';
    return 'Toàn cục';
  };

  const getScopeColor = (s: RealScope) => {
    if (s === 'chapter') return 'text-primary';
    if (s === 'book') return 'text-on-surface-variant';
    return 'text-on-surface';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-surface-container text-on-surface w-full max-w-[680px] mx-auto rounded-t-3xl sm:rounded-2xl max-h-[90vh] h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-10 overflow-hidden border-t sm:border border-outline-variant/30">
        
        <div className="flex-shrink-0 pt-2 px-3 sm:pt-4 sm:px-5 border-b border-outline-variant/10 bg-surface-container">
          <div className="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto mb-3 sm:hidden"></div>
          <div className="flex justify-between items-center pb-2 sm:pb-3">
            <div className="flex items-center bg-surface-container-highest/40 p-1 rounded-2xl sm:rounded-full border border-outline-variant/10 gap-1 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('api')}
                className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all duration-300 font-bold text-[12px] sm:text-[13px] outline-none whitespace-nowrap ${activeTab === 'api' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20 scale-100' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 scale-95 hover:scale-100'}`}
              >
                <MonitorSmartphone size={16} className={activeTab === 'api' ? 'animate-pulse' : ''} />
                <span className={activeTab === 'api' ? 'block' : 'hidden sm:block'}>Cơ bản</span>
              </button>
              
              {!isOfflineMode && (
                <button 
                  onClick={() => setActiveTab('names')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all duration-300 font-bold text-[12px] sm:text-[13px] outline-none whitespace-nowrap ${activeTab === 'names' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20 scale-100' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 scale-95 hover:scale-100'}`}
                >
                  <Edit3 size={16} />
                  <span className={activeTab === 'names' ? 'block' : 'hidden sm:block'}>Từ điển</span>
                </button>
              )}

              <button 
                onClick={() => setActiveTab('voice')}
                className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all duration-300 font-bold text-[12px] sm:text-[13px] outline-none whitespace-nowrap ${activeTab === 'voice' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20 scale-100' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 scale-95 hover:scale-100'}`}
              >
                <Volume2 size={16} />
                <span className={activeTab === 'voice' ? 'block' : 'hidden sm:block'}>Giọng đọc</span>
              </button>

              {!isOfflineMode && (
                <button 
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all duration-300 font-bold text-[12px] sm:text-[13px] outline-none whitespace-nowrap ${activeTab === 'ai' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20 scale-100' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 scale-95 hover:scale-100'}`}
                >
                  <Bot size={16} />
                  <span className={activeTab === 'ai' ? 'block' : 'hidden sm:block'}>AI</span>
                </button>
              )}

              <button 
                onClick={() => setActiveTab('servers')}
                className={`flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-full transition-all duration-300 font-bold text-[12px] sm:text-[13px] outline-none whitespace-nowrap ${activeTab === 'servers' ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/20 scale-100' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60 scale-95 hover:scale-100'}`}
              >
                <Server size={16} />
                <span className={activeTab === 'servers' ? 'block' : 'hidden sm:block'}>Máy chủ API</span>
              </button>
            </div>

            <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 ml-2 flex items-center justify-center bg-surface-container-highest/30 hover:bg-surface-bright rounded-full text-on-surface-variant hover:text-on-surface hover:rotate-90 transition-all duration-300 active:scale-95">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col bg-surface">
          
          {activeTab === 'api' && (
            <div className="p-5 flex flex-col gap-8">
              
              {/* Display Settings Section */}
              <div className="flex flex-col gap-6">
                <h3 className="font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                  <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                  Giao diện đọc
                </h3>
                
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
                      <FontButton currentFont={font} targetFont="palatino" label="Palatino" onClick={() => setFont('palatino')} fontFamily='Monospace,font-serif' />
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

                  <hr className="border-outline-variant/10 -mx-5" />

                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-3">
                      <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Số truyện mỗi trang</h2>
                      <div className="flex bg-surface-container-highest rounded-xl p-1 items-center gap-1">
                         <button onClick={() => setBookLimit(Math.max(10, (bookLimit || 20) - 10))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                          -
                         </button>
                         <div className="flex-1 text-center font-bold text-sm text-primary flex items-center justify-center gap-1.5">
                           <BookOpen size={14} className="opacity-70" />
                           {bookLimit || 20}
                         </div>
                         <button onClick={() => setBookLimit(Math.min(100, (bookLimit || 20) + 10))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                          +
                         </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <h2 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Số chương mỗi trang</h2>
                      <div className="flex bg-surface-container-highest rounded-xl p-1 items-center gap-1">
                         <button onClick={() => setChapterLimit(Math.max(10, (chapterLimit || 50) - 10))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                          -
                         </button>
                         <div className="flex-1 text-center font-bold text-sm text-primary flex items-center justify-center gap-1.5">
                           <List size={14} className="opacity-70" />
                           {chapterLimit || 50}
                         </div>
                         <button onClick={() => setChapterLimit(Math.min(200, (chapterLimit || 50) + 10))} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-surface-bright active:scale-95 transition-all text-on-surface flex-shrink-0">
                          +
                         </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'names' && (
            <>
              {/* Add/Edit Form Fixed at Top of Scrollable area */}
              <div className="p-3 sm:p-4 border-b border-outline-variant/10 sticky top-0 z-100 flex flex-col gap-3 bg-surface-container/95 backdrop-blur-md shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Edit3 size={14} className="text-primary" />
                     <h3 className="text-[11px] font-bold text-on-surface uppercase tracking-widest">{editingId ? 'Chỉnh sửa' : 'Thêm từ'}</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer group" title="Bật/Tắt Thay thế">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isEnabledReplace}
                      onChange={(e) => setIsEnabledReplace(e.target.checked)}
                    />
                    <div className="w-10 h-[22px] bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#1a1a1a] after:border-black after:border after:rounded-full after:h-[16px] after:w-[16px] after:transition-all peer-checked:bg-primary peer-checked:after:bg-black group-hover:opacity-90"></div>
                  </label>
                </div>
                
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center bg-surface-container-highest/20 border border-outline-variant/20 rounded-xl p-1 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <input 
                      type="text" 
                      placeholder="Từ gốc" 
                      value={matchStr}
                      onChange={(e) => setMatchStr(e.target.value)}
                      className="flex-1 w-full min-w-0 bg-transparent py-2 pl-3 pr-2 text-[13px] sm:text-sm focus:outline-none text-on-surface placeholder-on-surface-variant/40 font-medium"
                    />
                    <div className="flex items-center justify-center px-1 text-primary opacity-60">
                      <ArrowRight size={14} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="Thay thế bằng" 
                      value={replacementStr}
                      onChange={(e) => setReplacementStr(e.target.value)}
                      className="flex-1 w-full min-w-0 bg-transparent py-2 pr-3 pl-2 text-[13px] sm:text-sm focus:outline-none text-primary placeholder-primary/40 font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex bg-surface-container-highest/30 rounded-lg p-1 border border-outline-variant/10">
                      <button 
                        onClick={() => setScope('chapter')}
                        title="Trong chương này"
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${scope === 'chapter' ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Chương
                      </button>
                      <button 
                        onClick={() => setScope('book')}
                        title="Toàn bộ truyện"
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${scope === 'book' ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Truyện
                      </button>
                      <button 
                        onClick={() => setScope('global')}
                        title="Tất cả truyện"
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${scope === 'global' ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Toàn cục
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {editingId && (
                        <button 
                          onClick={() => { setEditingId(null); setMatchStr(''); setReplacementStr(''); }}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest hover:text-error transition-colors"
                          title="Hủy"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <button 
                        onClick={handleSaveName}
                        disabled={!matchStr.trim() || !replacementStr.trim()}
                        className="w-8 h-8 sm:w-auto sm:px-4 flex items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all gap-1.5 shadow-sm"
                        title="Lưu"
                      >
                        <Save size={14} />
                        <span className="hidden sm:block text-[11px] font-bold">Lưu</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-4 sm:gap-5 pb-24">
                {/* Search & Filter */}
                <div className="flex gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70" size={16} />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm từ thay thế..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-surface-container-highest/10 border border-outline-variant/20 rounded-full py-2 pl-9 pr-3 text-xs sm:text-[13px] focus:outline-none focus:border-primary/50 text-on-surface"
                    />
                  </div>
                  <div className="relative">
                    <select 
                      value={filterScope}
                      onChange={(e) => setFilterScope(e.target.value as RealScope | 'all')}
                      className="h-full pl-8 pr-3 py-2 bg-surface-container-highest/10 text-xs sm:text-[13px] border border-outline-variant/20 rounded-full appearance-none focus:outline-none focus:border-primary/50 text-on-surface"
                    >
                      <option value="all">Tất cả</option>
                      <option value="chapter">Chương</option>
                      <option value="book">Truyện</option>
                      <option value="global">Toàn cục</option>
                    </select>
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-70 pointer-events-none" size={14} />
                  </div>
                </div>

                {/* List */}
                <div className="flex flex-col gap-2 sm:gap-3">
                  {loading ? (
                    <div className="text-center py-10 text-xs text-on-surface-variant">Đang tải...</div>
                  ) : filteredReplacements.length === 0 ? (
                    <div className="text-center py-8 sm:py-10 text-xs sm:text-[13px] text-on-surface-variant">Không tìm thấy từ thay thế nào.</div>
                  ) : filteredReplacements.map(r => (
                    <div 
                      key={r.id}
                      className={`group flex items-center justify-between gap-1.5 sm:gap-3 p-2 sm:p-3 rounded-2xl border transition-all duration-300 hover:shadow-md ${editingId === r.id ? 'border-primary shadow-sm bg-primary/5 ring-1 ring-primary/20 scale-[1.01]' : 'border-outline-variant/20 bg-surface-container-lowest hover:border-outline-variant/40 hover:bg-surface'}`}
                    >
                      <div className="flex flex-1 items-center min-w-0">
                         {/* Match string [a] */}
                         <div className="relative flex-1 min-w-0 bg-surface-container-highest/20 border border-outline-variant/30 rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.02)] pl-8 sm:pl-9">
                             {/* Badge */}
                             <div 
                              className={`absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 flex items-center justify-center rounded-[6px] sm:rounded-lg text-[10px] sm:text-[11px] font-black shadow-sm ${
                                r.scope === 'chapter' ? 'bg-primary text-on-primary' : 
                                r.scope === 'book' ? 'bg-[#b47a18] text-black' : 
                                'bg-surface-variant text-on-surface-variant border border-outline-variant/30'
                              }`}
                              title={r.scope === 'chapter' ? 'Chương' : r.scope === 'book' ? 'Truyện' : 'Toàn cục'}
                             >
                              {r.scope === 'chapter' ? 'C' : r.scope === 'book' ? 'B' : 'G'}
                             </div>
                             <span className="text-[12px] sm:text-[14px] text-on-surface-variant font-medium truncate line-through decoration-on-surface-variant/40" title={r.match}>{r.match}</span>
                         </div>
                         
                         {/* Arrow */}
                         <div className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-surface-container border border-outline-variant/20 text-on-surface-variant shadow-sm z-10 -mx-3 sm:-mx-3.5 group-hover:text-primary transition-colors duration-300">
                           <ArrowRight size={14} className="sm:hidden" strokeWidth={3} />
                           <ArrowRight size={16} className="hidden sm:block" strokeWidth={3} />
                         </div>

                         {/* Replacement string [b] */}
                         <div className="flex-1 min-w-0 bg-primary/5 border border-primary/20 rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center shadow-[inset_0_1px_2px_max(rgba(0,0,0,0.02),var(--color-primary-shadow,transparent))] pl-4 sm:pl-5">
                            <span className="text-[12px] sm:text-[14px] font-extrabold text-primary truncate" title={r.replacement}>{r.replacement}</span>
                         </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0">
                        <button 
                          onClick={() => handleEdit(r)}
                          className={`w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full transition-all duration-200 ${editingId === r.id ? 'bg-primary text-on-primary shadow-md scale-105' : 'text-on-surface-variant hover:bg-surface-variant hover:text-primary active:scale-95'}`}
                          title="Sửa"
                        >
                          <Edit3 size={14} className="sm:hidden" strokeWidth={2.5} />
                          <Edit3 size={16} className="hidden sm:block" strokeWidth={2.5} />
                        </button>
                        <button 
                          onClick={(e) => handleDelete(r.id, e)}
                          className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-all duration-200 active:scale-95"
                          title="Xóa"
                        >
                          <Trash2 size={14} className="sm:hidden" strokeWidth={2.5} />
                          <Trash2 size={16} className="hidden sm:block" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'voice' && (
            <div className="p-5 flex flex-col gap-6">
              <h3 className="font-bold text-on-surface flex items-center gap-2 border-b border-outline-variant/20 pb-2">
                <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                Giọng đọc (Text-to-Speech)
              </h3>
              
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Chọn giọng đọc
                  </label>
                  <VoiceSelect />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                      Tốc độ đọc
                    </label>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{Number(speechRate.toFixed(2))}x</span>
                  </div>
                  <div className="flex items-center gap-4 bg-surface-container-highest rounded-xl p-3">
                    <button onClick={() => setSpeechRate(Math.max(0.2, Number((speechRate - 0.05).toFixed(2))))} className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                      -
                    </button>
                    <input 
                      type="range" min="0.2" max="3.0" step="0.05" 
                      value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="flex-1 accent-primary h-1.5 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full cursor-pointer bg-surface-container-lowest"
                    />
                    <button onClick={() => setSpeechRate(Math.min(3.0, Number((speechRate + 0.05).toFixed(2))))} className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-lowest text-on-surface hover:bg-surface-bright active:scale-95 transition-all text-sm font-bold flex-shrink-0">
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 sm:p-5 flex-shrink-0 border-b border-outline-variant/10 bg-surface">
                <div className="flex bg-surface-container-highest/50 p-1 rounded-full w-full sm:w-fit mx-auto sm:mx-0">
                  <button
                    onClick={() => setAiSubTab('tokens')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${aiSubTab === 'tokens' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    API Tokens
                  </button>
                  <button
                    onClick={() => setAiSubTab('models')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-[13px] font-bold transition-all duration-300 ${aiSubTab === 'models' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    AI Models
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                {aiSubTab === 'tokens' ? (
                  <TokenManagerSheet isEmbedded={true} />
                ) : (
                  <QuotaSettingsSheet isEmbedded={true} />
                )}
              </div>
            </div>
          )}

          {activeTab === 'servers' && (
            <div className="p-5 flex flex-col gap-6">
              <h3 className="font-bold text-on-surface flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#b47a18] rounded-full"></span>
                  Máy chủ API
                </div>
                {!showDomainForm && (
                  <button 
                    onClick={() => {
                      setEditingDomainId(null);
                      setDomainName('');
                      setDomainUrl('');
                      setShowDomainForm(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus size={14} /> Thêm mới
                  </button>
                )}
              </h3>
              
              {showDomainForm && (
                <div className="bg-surface-container-lowest p-3 sm:p-4 rounded-xl border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">Tên máy chủ</label>
                      <input 
                        type="text" 
                        value={domainName}
                        onChange={e => setDomainName(e.target.value)}
                        placeholder="VD: Server Chính"
                        className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-wider">URL</label>
                    <input 
                      type="url" 
                      value={domainUrl}
                      onChange={e => setDomainUrl(e.target.value)}
                      placeholder="VD: https://api.example.com"
                      className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="flex gap-2 justify-end mt-1">
                    <button 
                      onClick={() => setShowDomainForm(false)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleSaveDomain}
                      disabled={!domainUrl.trim()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#b47a18] text-black hover:bg-[#c98a1b] disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      <Save size={12} /> Lưu lại
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                {apiDomains.length === 0 ? (
                  <div className="text-center py-6 text-on-surface-variant text-xs">Chưa có máy chủ nào được cấu hình.</div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Máy chủ đang hoạt động</span>
                      </div>
                      
                      {apiDomains.filter(d => d.id === (activeDomainId || apiDomains[0]?.id)).map(domain => (
                        <div 
                          key={domain.id} 
                          className="group flex items-center justify-between p-2.5 px-3 border rounded-xl gap-3 transition-colors cursor-pointer bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                        >
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border shrink-0 bg-surface transition-colors border-primary">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[12px] sm:text-[13px] truncate font-bold text-primary">{domain.name}</span>
                              {apiDomains[0]?.id === domain.id && (
                                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[9px] font-black shrink-0 leading-none">Mặc định</span>
                              )}
                            </div>
                            <span className="text-[10px] sm:text-[11px] truncate opacity-80 text-primary/80 font-medium">{domain.url}</span>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => handleEditDomain(domain)}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Danh sách máy chủ ({apiDomains.filter(d => d.id !== (activeDomainId || apiDomains[0]?.id)).length})</span>
                        <button 
                          onClick={handleFetchDomainsFromAPI}
                          disabled={isFetchingDomains}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                          title="Tải từ máy chủ"
                        >
                          <RefreshCw size={12} className={isFetchingDomains ? "animate-spin" : ""} />
                        </button>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        {apiDomains.filter(d => d.id !== (activeDomainId || apiDomains[0]?.id)).map(domain => (
                          <div 
                            key={domain.id} 
                            onClick={() => {
                              if (testingDomainId === domain.id) return;
                              handleSelectActiveDomain(domain.id);
                            }}
                            className={cn(
                              "group flex items-center justify-between p-2.5 px-3 border rounded-xl gap-3 transition-colors cursor-pointer bg-surface-container-lowest border-outline-variant/20 hover:border-outline-variant/40 hover:bg-surface-container-lowest/80",
                              testingDomainId === domain.id ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                            )}
                          >
                            <div className="flex items-center justify-center w-5 h-5 rounded-full border shrink-0 bg-surface transition-colors border-outline-variant/40">
                              {testingDomainId === domain.id ? (
                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              ) : null}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[12px] sm:text-[13px] truncate font-bold text-on-surface">{domain.name}</span>
                                {apiDomains[0]?.id === domain.id && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-surface-container border border-outline-variant/30 text-on-surface-variant text-[9px] font-black shrink-0 leading-none">Mặc định</span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] truncate opacity-80 text-on-surface-variant">{domain.url}</span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => handleEditDomain(domain)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
                              >
                                <Edit3 size={12} />
                              </button>
                              {apiDomains[0]?.id !== domain.id && (
                                <button 
                                  onClick={(e) => handleDeleteDomain(domain.id, e)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function VoiceSelect() {
  const { voiceUri, setVoiceUri } = useReaderSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!synth) return;

    const loadVoices = () => {
      const allVoices = synth.getVoices();
      const viVoices = allVoices.filter(v => v.lang.includes('vi') || v.lang.includes('vi-VN'));
      setVoices(viVoices);
      if (viVoices.length > 0 && !voiceUri) {
        setVoiceUri(viVoices[0].voiceURI);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      synth.onvoiceschanged = null;
    };
  }, [voiceUri, setVoiceUri]);

  return (
    <div className="relative">
      <select 
        value={voiceUri} 
        onChange={(e) => setVoiceUri(e.target.value)}
        className="w-full bg-surface-container-highest border border-outline-variant/30 rounded-xl p-3 text-[13px] sm:text-sm focus:outline-none focus:border-primary/50 text-on-surface appearance-none"
      >
        {voices.length === 0 && <option value="">Đang tải giọng đọc...</option>}
        {voices.map(v => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={16} />
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

