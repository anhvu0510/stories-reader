import React, { useState, useEffect } from 'react';
import { X, Edit3, Search, Trash2, ArrowRight, Save, Filter } from 'lucide-react';
import { api, Replacement } from '../lib/api';
import { useReaderSettings } from '../contexts/ReaderContext';

type RealScope = 'chapter' | 'book' | 'global';

interface EditWordSheetProps {
  onClose: () => void;
  initialMatch?: string;
  currentBookId?: string;
  currentChapterId?: string;
}

export function EditWordSheet({ onClose, initialMatch = '', currentBookId, currentChapterId }: EditWordSheetProps) {
  const { isEnabledReplace, setIsEnabledReplace } = useReaderSettings();
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<RealScope | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [matchStr, setMatchStr] = useState(initialMatch);
  const [replacementStr, setReplacementStr] = useState('');
  const [scope, setScope] = useState<RealScope>('chapter');

  useEffect(() => {
    if (initialMatch) {
      setMatchStr(initialMatch);
    }
  }, [initialMatch]);

  useEffect(() => {
    // Load from API
    setLoading(true);
    api.getReplacements(currentBookId, currentChapterId).then(res => {
      setReplacements(res.data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [currentBookId, currentChapterId]);

  const handleSave = async () => {
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

      // Reset form
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
    if (window.confirm('Bạn có chắc chắn muốn xóa?')) {
      try {
        await api.deleteReplacement(id);
        setReplacements(prev => prev.filter(r => r.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setMatchStr('');
          setReplacementStr('');
        }
      } catch (e) {
        console.error("Failed to delete replacement", e);
      }
    }
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-surface-container text-on-surface w-full max-w-reading-max-width mx-auto rounded-t-3xl sm:rounded-2xl max-h-[90vh] h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] z-10 overflow-hidden border-t sm:border border-outline-variant/30">
        
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0 pt-3 px-5 pb-4 border-b border-outline-variant/10">
          <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-5"></div>
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-serif text-lg sm:text-xl font-bold flex items-center gap-2 text-on-surface">
              <Edit3 size={20} className="text-primary sm:w-[22px] sm:h-[22px]" />
              Từ thay thế (Names)
            </h2>
            <div className="flex items-center gap-2 sm:gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={isEnabledReplace}
                  onChange={(e) => setIsEnabledReplace(e.target.checked)}
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#1a1a1a] after:border-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-black"></div>
              </label>
              <button onClick={onClose} className="p-2 bg-surface-container-highest/50 rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
          
          {/* Add/Edit Form Fixed at Top of Scrollable area */}
          <div className="p-4 sm:p-5 border-b border-outline-variant/10 sticky top-0 z-10 flex flex-col gap-3 bg-surface-container">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{editingId ? 'Sửa từ' : 'Thêm từ mới'}</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center">
                <input 
                  type="text" 
                  placeholder="Từ gốc" 
                  value={matchStr}
                  onChange={(e) => setMatchStr(e.target.value)}
                  className="w-full sm:flex-1 bg-surface-container-highest/20 border border-outline-variant/20 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm focus:outline-none focus:border-primary/50 text-on-surface placeholder-on-surface-variant/50"
                />
                <ArrowRight size={16} className="text-on-surface-variant opacity-50 flex-shrink-0 hidden sm:block" />
                <input 
                  type="text" 
                  placeholder="Thay thế" 
                  value={replacementStr}
                  onChange={(e) => setReplacementStr(e.target.value)}
                  className="w-full sm:flex-1 bg-surface-container-highest/20 border border-outline-variant/20 rounded-xl py-2 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm focus:outline-none focus:border-primary/50 text-on-surface placeholder-on-surface-variant/50"
                />
              </div>
              <div className="flex flex-row justify-between items-center sm:mt-1 gap-2">
                <div className="flex bg-surface-container-highest/20 rounded-full p-1 border border-outline-variant/10 flex-1 sm:flex-none">
                  <button 
                    onClick={() => setScope('chapter')}
                    className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium rounded-full transition-all ${scope === 'chapter' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Chương
                  </button>
                  <button 
                    onClick={() => setScope('book')}
                    className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium rounded-full transition-all ${scope === 'book' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Truyện
                  </button>
                  <button 
                    onClick={() => setScope('global')}
                    className={`flex-1 sm:flex-none px-2 sm:px-4 py-1.5 text-[11px] sm:text-[13px] font-medium rounded-full transition-all ${scope === 'global' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Toàn cục
                  </button>
                </div>
                <button 
                  onClick={handleSave}
                  disabled={!matchStr.trim() || !replacementStr.trim()}
                  className="bg-[#b47a18] text-black px-4 sm:px-5 py-2 rounded-full text-[11px] sm:text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#c98a1b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save size={14} />
                  Lưu
                </button>
              </div>
              {editingId && (
                <button 
                  onClick={() => { setEditingId(null); setMatchStr(''); setReplacementStr(''); }}
                  className="text-[10px] sm:text-xs text-on-surface-variant underline self-end mt-1 hover:text-on-surface"
                >
                  Hủy sửa
                </button>
              )}
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
                  onClick={() => handleEdit(r)}
                  className={`flex flex-col gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl border cursor-pointer transition-all ${editingId === r.id ? 'border-primary/50 bg-primary/5' : 'border-outline-variant/10 bg-surface-container-highest/10 hover:bg-surface-container-highest/20'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-sm sm:text-base">
                      <span className="font-medium text-on-surface-variant line-through decoration-on-surface-variant/50">{r.match}</span>
                      <ArrowRight size={14} className="text-on-surface-variant opacity-50 sm:hidden" />
                      <ArrowRight size={16} className="text-on-surface-variant opacity-50 hidden sm:block" />
                      <span className="font-bold text-primary">{r.replacement}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(r.id, e)}
                      className="p-1.5 sm:p-2 text-on-surface-variant opacity-70 hover:opacity-100 hover:text-error hover:bg-error/10 rounded-full transition-colors -mt-1 -mr-1"
                    >
                      <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                  <div className="flex justify-start">
                    <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${getScopeColor(r.scope)} ${r.scope === 'chapter' ? 'bg-primary/10 px-1.5 sm:px-2 py-[1px] sm:py-0.5 rounded' : 'bg-surface-container-highest/30 px-1.5 sm:px-2 py-[1px] sm:py-0.5 rounded text-on-surface-variant'}`}>
                      {getScopeLabel(r.scope)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
