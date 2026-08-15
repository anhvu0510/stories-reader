import React, { useState, useEffect } from 'react';
import { X, Languages, Settings2, Sparkles, CheckSquare, Square, Search, ChevronDown, ChevronUp, Loader, Check, KeyRound, Group } from 'lucide-react';
import { Book, Chapter } from '../shared/types';
import { BookRepository } from '../repositories/BookRepository';
import { ChapterRepository } from '../repositories/ChapterRepository';
import { AIRepository } from '../repositories/AIRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { useToastStore } from '../stores/useToastStore';
import { cn } from '../lib/utils';

type Tab = 'current' | 'batch_chapter' | 'story';

interface TranslationOptions {
  model: string;
  platform?: string;
  minWords: number;
  maxWords: number;
  temperature: number;
  forceRetranslate: boolean;
  batchingGroup?: boolean;
  availableModels?: string[];
}

const defaultOptions: TranslationOptions = {
  model: 'gemini-2.5-flash-lite',
  platform: 'VERTEX_API',
  minWords: 100,
  maxWords: 500,
  temperature: 0.7,
  forceRetranslate: false,
  batchingGroup: false,
  availableModels: ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-pro']
};

interface TranslationSheetProps {
  onClose: () => void;
  currentBookName?: string;
  currentChapterName?: string;
  currentBookId?: string;
  currentChapterId?: string;
  currentChapterNumber?: number;
  initialTab?: Tab;
  initialSelectedChapters?: string[];
  onSuccess?: () => void;
  disableCurrent?: boolean;
}

export function TranslationSheet({
  onClose,
  currentBookName,
  currentChapterName,
  currentBookId,
  currentChapterId,
  currentChapterNumber,
  initialTab = 'batch_chapter',
  initialSelectedChapters = [],
  onSuccess,
  disableCurrent = false,
}: TranslationSheetProps) {
  const showToast = useToastStore((state) => state.showToast);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeModelTab, setActiveModelTab] = useState<'VERTEX_API' | 'AI_STUDIO'>('VERTEX_API');
  const [options, setOptions] = useState<TranslationOptions>(defaultOptions);
  const [isOptionsLoaded, setIsOptionsLoaded] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [poolStatus, setPoolStatus] = useState<any>(null);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(
    new Set(initialSelectedChapters)
  );
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [searchBook, setSearchBook] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const chapterListRef = React.useRef<HTMLDivElement>(null);
  const activeItemRef = React.useRef<HTMLDivElement>(null);
  const isInitialScrollDoneRef = React.useRef(false);

  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingBottom, setLoadingBottom] = useState(false);
  const [hasMoreTop, setHasMoreTop] = useState(false);
  const [hasMoreBottom, setHasMoreBottom] = useState(true);
  const [minChapterNum, setMinChapterNum] = useState<number>(1);
  const [maxChapterNum, setMaxChapterNum] = useState<number>(1);

  // Load configs from API
  const [quotas, setQuotas] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    if (options.model && isOptionsLoaded) {
      const platform = options.platform || 'VERTEX_API';
      ChapterRepository.getPoolStatus(options.model, platform)
        .then((res) => {
          if (active && res) {
            setPoolStatus(res);
          }
        })
        .catch((err) => {
          console.warn('Failed to fetch pool status:', err);
        });
    }
    return () => {
      active = false;
    };
  }, [options.model, options.platform, activeTab, isOptionsLoaded, quotas]);

  useEffect(() => {
    let active = true;

    // Load saved translate options from settings (force fresh fetch)
    SettingsRepository.getSettings('stories.ui.translate', true)
      .then((savedSettings) => {
        if (!active) return;
        if (savedSettings?.value) {
          try {
            const parsed = typeof savedSettings.value === 'string' ? JSON.parse(savedSettings.value) : savedSettings.value;
            if (parsed && typeof parsed === 'object') {
              setOptions((prev) => ({ ...prev, ...parsed }));
            }
          } catch (e) {}
        }
      })
      .catch(() => {});

    AIRepository.getQuotas()
      .then((res) => {
        if (!active) return;
        if (res) {
          const rawQuotas = (res as any).availableModels || (res as any).quotas || (Array.isArray(res) ? res : []);
          setQuotas(Array.isArray(rawQuotas) ? rawQuotas : []);

          const cfg = res.currentConfig || (res as any).config;
          if (cfg && typeof cfg === 'object') {
            let loadedPlatform = cfg.platform;
            setOptions((prev) => {
              const newOptions = { ...prev, ...cfg };
              const modelsList = (Array.isArray(rawQuotas) ? rawQuotas : []).map((m: any) => m.model || m);
              if (modelsList.length > 0) {
                newOptions.availableModels = modelsList;
              }
              return newOptions;
            });

            if (loadedPlatform) {
              setActiveModelTab(loadedPlatform as any);
            }
          }
        }
        setIsOptionsLoaded(true);
      })
      .catch((err) => {
        console.warn('AIRepository.getQuotas error, repairing database setting:', err);
        // Repair corrupt DB record by overwriting with valid JSON string
        SettingsRepository.updateSettings('stories.ui.translate', defaultOptions)
          .then(() => AIRepository.getQuotas())
          .then((res) => {
            if (active && res) {
              const rawQuotas = (res as any).availableModels || (res as any).quotas || (Array.isArray(res) ? res : []);
              setQuotas(Array.isArray(rawQuotas) ? rawQuotas : []);
            }
          })
          .catch(() => {})
          .finally(() => {
            if (active) setIsOptionsLoaded(true);
          });
      });

    return () => {
      active = false;
    };
  }, []);

  // Save configs to API
  const initialMount = React.useRef(true);
  useEffect(() => {
    if (isOptionsLoaded) {
      if (initialMount.current) {
        initialMount.current = false;
        return;
      }
      const t = setTimeout(() => {
        const payload = {
          model: options.model,
          platform: options.platform || 'VERTEX_API',
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          forceRetranslate: options.forceRetranslate,
          batchingGroup: options.batchingGroup,
          availableModels: options.availableModels,
        };
        SettingsRepository.updateSettings('stories.ui.translate', payload).catch(() => {});
      }, 500);
      return () => clearTimeout(t);
    }
  }, [options, isOptionsLoaded, quotas]);

  const loadInitialChapters = React.useCallback(async () => {
    if (activeTab !== 'batch_chapter' || !currentBookId) return;
    setLoading(true);
    isInitialScrollDoneRef.current = false;

    const startChapterNumber = currentChapterNumber
      ? Math.max(1, currentChapterNumber - 5)
      : 1;
    const endChapterNumber = currentChapterNumber
      ? currentChapterNumber + 20
      : undefined;

    try {
      const res = await ChapterRepository.getChapters(
        currentBookId,
        1,
        26,
        'chapterNumber',
        'ASC',
        'all',
        '',
        startChapterNumber,
        endChapterNumber
      );

      const newChapters = res?.chapters || [];
      setChapters(newChapters);

      if (newChapters.length > 0) {
        const minNum = Math.min(...newChapters.map((c) => c.chapterNumber));
        const maxNum = Math.max(...newChapters.map((c) => c.chapterNumber));
        setMinChapterNum(minNum);
        setMaxChapterNum(maxNum);
        setHasMoreTop(minNum > 1);
        setHasMoreBottom(newChapters.length >= 20);
      } else {
        setHasMoreTop(false);
        setHasMoreBottom(false);
      }
    } catch {
      setChapters([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentBookId, currentChapterNumber]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (activeTab === 'batch_chapter' && currentBookId) {
      loadInitialChapters();
    } else if (activeTab === 'story') {
      const fetchStoryBooks = () => {
        BookRepository.getBooks(1, 9999, searchBook)
          .then((res) => {
            const list = res?.books || (res as any)?.data || (Array.isArray(res) ? res : []);
            setBooks(Array.isArray(list) ? list : []);
          })
          .catch((err) => {
            console.warn('Failed to fetch books for translation:', err);
            setBooks([]);
          });
      };

      if (searchBook) {
        t = setTimeout(fetchStoryBooks, 300);
      } else {
        fetchStoryBooks();
      }
    }
    return () => clearTimeout(t);
  }, [activeTab, currentBookId, searchBook, loadInitialChapters]);

  const scrollToActive = React.useCallback(() => {
    if (activeItemRef.current && chapterListRef.current) {
      const container = chapterListRef.current;
      const activeEl = activeItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
      container.scrollTop = Math.max(0, targetScrollTop);
    }
  }, []);

  React.useLayoutEffect(() => {
    if (activeTab === 'batch_chapter' && !loading && chapters.length > 0 && !isInitialScrollDoneRef.current) {
      isInitialScrollDoneRef.current = true;
      scrollToActive();
      requestAnimationFrame(() => {
        scrollToActive();
        setTimeout(scrollToActive, 50);
        setTimeout(scrollToActive, 150);
      });
    }
  }, [activeTab, loading, chapters, scrollToActive]);

  // Auto-backfill previous chapters if initial viewport has extra space and hasMoreTop is true
  useEffect(() => {
    if (activeTab === 'batch_chapter' && !loading && !loadingTop && hasMoreTop && chapterListRef.current) {
      const { scrollHeight, clientHeight } = chapterListRef.current;
      if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
        fetchPrevTopPage();
      }
    }
  }, [activeTab, loading, loadingTop, hasMoreTop, chapters.length]);

  const fetchNextBottomPage = async () => {
    if (loadingBottom || !hasMoreBottom || !currentBookId) return;
    setLoadingBottom(true);
    const targetFromChapter = maxChapterNum + 1;

    try {
      const res = await ChapterRepository.getChapters(
        currentBookId,
        1,
        PAGE_SIZE,
        'chapterNumber',
        'ASC',
        'all',
        '',
        targetFromChapter
      );

      const newChapters = res?.chapters || [];
      if (newChapters.length > 0) {
        setChapters((prev) => {
          const existingIds = new Set(prev.map((c) => c.chapterId));
          const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
          return [...prev, ...uniqueNew];
        });
        const newMax = Math.max(...newChapters.map((c) => c.chapterNumber));
        setMaxChapterNum(newMax);
        setHasMoreBottom(newChapters.length >= PAGE_SIZE);
      } else {
        setHasMoreBottom(false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingBottom(false);
    }
  };

  const fetchPrevTopPage = async () => {
    if (loadingTop || !hasMoreTop || minChapterNum <= 1 || !currentBookId) return;
    setLoadingTop(true);

    const container = chapterListRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;
    const targetToChapter = minChapterNum - 1;
    const targetFromChapter = Math.max(1, minChapterNum - PAGE_SIZE);

    try {
      const res = await ChapterRepository.getChapters(
        currentBookId,
        1,
        PAGE_SIZE,
        'chapterNumber',
        'ASC',
        'all',
        '',
        targetFromChapter,
        targetToChapter
      );

      const newChapters = res?.chapters || [];
      if (newChapters.length > 0) {
        setChapters((prev) => {
          const existingIds = new Set(prev.map((c) => c.chapterId));
          const uniqueNew = newChapters.filter((c) => !existingIds.has(c.chapterId));
          return [...uniqueNew, ...prev];
        });

        const newMin = Math.min(...newChapters.map((c) => c.chapterNumber));
        setMinChapterNum(newMin);
        setHasMoreTop(newMin > 1);

        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      } else {
        setHasMoreTop(false);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTop(false);
    }
  };

  const handleScroll = () => {
    if (!chapterListRef.current || loading || activeTab !== 'batch_chapter') return;
    const { scrollTop, clientHeight, scrollHeight } = chapterListRef.current;

    if (scrollTop + clientHeight >= scrollHeight - 80) {
      fetchNextBottomPage();
    }
    if (scrollTop <= 50) {
      fetchPrevTopPage();
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const platform = options.platform || 'VERTEX_API';
    try {
      if (activeTab === 'current') {
        const chapterIdToUse = initialSelectedChapters[0] || currentChapterId;
        if (!chapterIdToUse) {
          showToast('Không xác định được chương hiện tại', 'error');
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }

        showToast('Đang gửi yêu cầu dịch...', 'info');
        await ChapterRepository.translate({
          mode: 'current',
          model: options.model,
          platform: platform,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          bookId: currentBookId,
          chapterId: [chapterIdToUse],
        });

        showToast('Gửi yêu cầu dịch thành công!', 'success');
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else if (activeTab === 'batch_chapter' && currentBookId) {
        if (selectedChapters.size === 0) {
          showToast('Vui lòng chọn ít nhất 1 chương', 'error');
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }

        await ChapterRepository.translate({
          mode: 'batch_chapter',
          model: options.model,
          platform: platform,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          batchingGroup: options.batchingGroup,
          bookId: currentBookId,
          chapterId: Array.from(selectedChapters),
          currentChapterId: initialSelectedChapters[0] || currentChapterId,
        });
        showToast(`Đã gửi yêu cầu dịch ${selectedChapters.size} chương`, 'success');
        setTimeout(() => onClose(), 1500);
      } else if (activeTab === 'story') {
        if (selectedBooks.size === 0) {
          showToast('Vui lòng chọn ít nhất 1 truyện', 'error');
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return;
        }

        await ChapterRepository.translate({
          mode: 'story',
          model: options.model,
          platform: platform,
          minWords: options.minWords,
          maxWords: options.maxWords,
          temperature: options.temperature,
          retryTranslate: options.forceRetranslate,
          batchingGroup: options.batchingGroup,
          bookId: Array.from(selectedBooks),
          currentChapterId: initialSelectedChapters[0] || currentChapterId,
        });
        showToast(`Đã gửi yêu cầu dịch ${selectedBooks.size} truyện`, 'success');
        setTimeout(() => onClose(), 1500);
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Có lỗi xảy ra, vui lòng thử lại', 'error');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const toggleChapter = (id: string) => {
    const next = new Set(selectedChapters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedChapters(next);
  };

  const handleSelectRange = async () => {
    const start = parseInt(rangeStart);
    const end = parseInt(rangeEnd);
    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      showToast("Phạm vi không hợp lệ", "error");
      return;
    }

    if (!currentBookId) return;

    try {
      const limit = Math.max(50, end - start + 1);
      const res = await ChapterRepository.getChapters(
        currentBookId,
        1,
        limit,
        'chapterNumber',
        'ASC',
        'all',
        '',
        start,
        end
      );

      const fetchedChapters = res?.chapters || [];

      let allChapters: Chapter[] = [];
      setChapters((prev) => {
        const existingIds = new Set(prev.map((c) => c.chapterId));
        const uniqueNew = fetchedChapters.filter((c) => !existingIds.has(c.chapterId));
        const combined = [...prev, ...uniqueNew].sort((a, b) => a.chapterNumber - b.chapterNumber);
        allChapters = combined;

        if (combined.length > 0) {
          const minNum = Math.min(...combined.map((c) => c.chapterNumber));
          const maxNum = Math.max(...combined.map((c) => c.chapterNumber));
          setMinChapterNum(minNum);
          setMaxChapterNum(maxNum);
        }
        return combined;
      });

      const chaptersInRange = (fetchedChapters.length > 0 ? fetchedChapters : allChapters).filter(
        (c) => c.chapterNumber >= start && c.chapterNumber <= end
      );

      if (chaptersInRange.length === 0) {
        showToast("Không tìm thấy chương nào trong phạm vi này", "error");
        return;
      }

      setSelectedChapters((prev) => {
        const newSet = new Set(prev);
        chaptersInRange.forEach((c) => newSet.add(c.chapterId));
        return newSet;
      });

      showToast(`Đã chọn ${chaptersInRange.length} chương (Chương ${start} - ${end})`, "success");

      setTimeout(() => {
        if (chapterListRef.current) {
          const firstEl = chapterListRef.current.querySelector(`#chapter-item-${start}`);
          if (firstEl) {
            const container = chapterListRef.current;
            const containerRect = container.getBoundingClientRect();
            const activeRect = firstEl.getBoundingClientRect();
            const targetScrollTop = container.scrollTop + (activeRect.top - containerRect.top);
            container.scrollTop = Math.max(0, targetScrollTop);
          }
        }
      }, 100);
    } catch {
      showToast("Có lỗi xảy ra khi tải dải chương", "error");
    }
  };

  const handleSelectAll = async () => {
    if (!currentBookId) return;
    setShowOnlyPending(false);
    if (!hasMoreTop && !hasMoreBottom && chapters.length > 0) {
      setSelectedChapters(new Set(chapters.map((c) => c.chapterId)));
      showToast(`Đã chọn tất cả ${chapters.length} chương`, "success");
      return;
    }

    setIsSubmitting(true);
    showToast("Đang tải tất cả chương...", "info");
    try {
      const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
      const allList = res?.chapters || [];
      if (allList.length > 0) {
        setChapters(allList);
        setSelectedChapters(new Set(allList.map((c) => c.chapterId)));
        const minNum = Math.min(...allList.map((c) => c.chapterNumber));
        const maxNum = Math.max(...allList.map((c) => c.chapterNumber));
        setMinChapterNum(minNum);
        setMaxChapterNum(maxNum);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        showToast(`Đã chọn tất cả ${allList.length} chương`, "success");
      }
    } catch {
      showToast("Có lỗi xảy ra khi tải danh sách chương", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPending = async () => {
    if (!currentBookId) return;
    setShowOnlyPending(true);
    if (!hasMoreTop && !hasMoreBottom && chapters.length > 0) {
      const pendingList = chapters.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
      setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
      showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, "success");
      return;
    }

    setIsSubmitting(true);
    showToast("Đang tải chương chưa dịch...", "info");
    try {
      const res = await ChapterRepository.getChapters(currentBookId, 1, 9999, 'chapterNumber', 'ASC', 'all');
      const allList = res?.chapters || [];
      if (allList.length > 0) {
        setChapters(allList);
        const pendingList = allList.filter((c) => c.state === 'PENDING' || c.state === 'FAILED');
        setSelectedChapters(new Set(pendingList.map((c) => c.chapterId)));
        const minNum = Math.min(...allList.map((c) => c.chapterNumber));
        const maxNum = Math.max(...allList.map((c) => c.chapterNumber));
        setMinChapterNum(minNum);
        setMaxChapterNum(maxNum);
        setHasMoreTop(false);
        setHasMoreBottom(false);
        showToast(`Đã chọn ${pendingList.length} chương chưa dịch`, "success");
      }
    } catch {
      showToast("Có lỗi xảy ra khi tải danh sách chương", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBook = (id: string) => {
    const next = new Set(selectedBooks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBooks(next);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center p-0 bg-black/80 overflow-x-hidden box-border">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Sheet Content */}
      <div className="relative bg-surface-container text-on-surface w-full max-w-md mx-auto rounded-t-[28px] h-[78vh] min-h-[520px] max-h-[85dvh] flex flex-col shadow-2xl z-10 overflow-hidden box-border transform-gpu overscroll-contain transition-all duration-200">
        
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0 pt-3 px-4 sm:px-5 pb-3 border-b border-outline-variant/20 bg-surface-container-low">
          <div className="w-12 h-1.5 bg-outline-variant/30 rounded-full mx-auto mb-2 sm:mb-3"></div>
          <div className="flex justify-between items-center bg-surface-container p-1 rounded-xl">
             <div className="flex bg-surface-container-low p-1 rounded-lg flex-1">
               <TabButton active={activeTab === 'current'} onClick={() => setActiveTab('current')} disabled={disableCurrent}>Hiện tại</TabButton>
               <TabButton active={activeTab === 'batch_chapter'} onClick={() => setActiveTab('batch_chapter')}>Nhiều chương</TabButton>
               <TabButton active={activeTab === 'story'} onClick={() => setActiveTab('story')}>Truyện</TabButton>
             </div>
             <button onClick={onClose} className="p-2 ml-2 bg-surface-container-highest/50 rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
               <X size={16} className="sm:w-5 sm:h-5" />
             </button>
          </div>
        </div>


        {/* Global Config (Stuck below header) */}
        <div className="flex-shrink-0 bg-surface-container-low border-b border-outline-variant/10">
          <div 
            className="w-full flex items-center justify-between py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest hover:bg-surface-container-high transition-colors cursor-pointer select-none"
            onClick={() => setShowConfig(!showConfig)}
          >
            <div className="flex items-center gap-2">
              <Settings2 size={12} />
              <span>Cấu hình AI</span>
              {poolStatus && poolStatus.model === options.model && (
                <span className="ml-2 text-[9px] font-bold text-on-surface-variant bg-surface-container-highest px-1.5 py-0.5 rounded border border-outline-variant/20 flex items-center gap-1">
                   <div className={`w-1 h-1 rounded-full ${poolStatus.remain > 0 ? 'bg-primary animate-pulse' : 'bg-error'}`}></div>
                   RPD: <span className={poolStatus.remain > 0 ? 'text-primary' : 'text-error'}>{poolStatus.remain.toLocaleString()}</span>/{poolStatus.total > 0 ? poolStatus.total.toLocaleString() : '∞'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(activeTab === 'batch_chapter' || activeTab === 'story') && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setOptions({...options, batchingGroup: !options.batchingGroup});
                  }}
                  className={cn(
                    "p-1.5 rounded-lg transition-all active:scale-95",
                    options.batchingGroup 
                      ? "bg-primary text-on-primary shadow-sm shadow-primary/20" 
                      : "bg-surface-container-highest text-on-surface-variant/50"
                  )}
                  title="Gộp chung văn cảnh"
                >
                  <Group size={12} />
                </button>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setOptions({...options, forceRetranslate: !options.forceRetranslate});
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all active:scale-95",
                  options.forceRetranslate 
                    ? "bg-primary text-on-primary shadow-sm shadow-primary/20" 
                    : "bg-surface-container-highest text-on-surface-variant/50"
                )}
                title="Dịch lại toàn bộ"
              >
                <Sparkles size={12} />
              </button>
              {showConfig ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </div>
          </div>
          
          {showConfig && (
            <div className="px-3 p-3 flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto hide-scrollbar">
              {/* Model selection as chips for mobile */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase px-0.5">GIỚI HẠN TỪ</label>
                  <div className="flex items-center bg-surface-container-highest rounded-lg p-0.5">
                    <input 
                      type="number" value={options.minWords}
                      onChange={(e) => setOptions({...options, minWords: Number(e.target.value)})}
                      className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
                    />
                    <span className="text-on-surface-variant/30 text-[10px]">-</span>
                    <input 
                      type="number" value={options.maxWords}
                      onChange={(e) => setOptions({...options, maxWords: Number(e.target.value)})}
                      className="w-full bg-transparent text-[11px] font-bold text-center focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                   <div className="flex justify-between items-center px-0.5">
                     <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">SÁNG TẠO</label>
                     <span className="text-[10px] font-bold text-primary">{Number(options.temperature).toFixed(1)}</span>
                   </div>
                   <div className="bg-surface-container-highest rounded-lg p-1 px-2 h-full flex items-center">
                     <input 
                       type="range" min="0" max="1" step="0.1" 
                       value={options.temperature}
                       onChange={(e) => setOptions({...options, temperature: Number(e.target.value)})}
                       className="w-full accent-primary h-1 bg-outline-variant/20 rounded-full appearance-none cursor-pointer"
                     />
                   </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-[9px] font-bold text-on-surface-variant/70 uppercase">MODEL</label>
                  <div className="flex bg-surface-container-high p-0.5 rounded-lg">
                    <button 
                      onClick={() => {
                         setActiveModelTab('VERTEX_API');
                         setPoolStatus(null);
                      }}
                      className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", activeModelTab === 'VERTEX_API' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}
                    >VERTEX API</button>
                    <button 
                      onClick={() => {
                         setActiveModelTab('AI_STUDIO');
                         setPoolStatus(null);
                      }}
                      className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", activeModelTab === 'AI_STUDIO' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface')}
                    >AI STUDIO</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(() => {
                    const filteredQuotas = quotas.filter((q) => {
                      const isPlatformMatch = (q.platform || 'VERTEX_API') === activeModelTab;
                      const isActive = q.isActive !== false;
                      return isPlatformMatch && isActive;
                    });

                    const modelsToRender =
                      filteredQuotas.length > 0
                        ? filteredQuotas.map((q) => q.model)
                        : (options.availableModels && options.availableModels.length > 0
                            ? options.availableModels
                            : defaultOptions.availableModels!);

                    return modelsToRender.map((m) => {
                      const isSelected = options.model === m && (options.platform || 'VERTEX_API') === activeModelTab;

                      return (
                        <button
                          key={`${activeModelTab}-${m}`}
                          onClick={() => {
                            setOptions({ ...options, model: m, platform: activeModelTab });
                            setPoolStatus(null);
                          }}
                          className={cn(
                            'px-3 py-2 rounded-lg text-left border transition-all flex items-center justify-between',
                            isSelected
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-surface-container-highest border-transparent text-on-surface-variant hover:bg-surface-container-high'
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold text-xs truncate">
                              {m.replace(/^gemini-/, '').replace(/-/g, ' ').toUpperCase() || m}
                            </div>
                          </div>
                          {isSelected && <Check size={12} className="text-primary flex-shrink-0" />}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Dynamic Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 flex flex-col min-h-0">
          {activeTab === 'current' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 h-full my-auto">
              <p className="text-[10px] sm:text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Chương đang mở</p>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-primary leading-snug">{currentChapterName || 'Chưa chọn chương'}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant mt-2 font-medium">{currentBookName}</p>
            </div>
          )}

          {activeTab === 'batch_chapter' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-wider">Chọn chương ({selectedChapters.size}/{chapters.length})</p>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showOnlyPending}
                        onChange={(e) => setShowOnlyPending(e.target.checked)}
                        className="accent-primary w-3.5 h-3.5 rounded cursor-pointer"
                      />
                      <span className="text-[11px] text-on-surface-variant font-medium select-none">Ẩn đã dịch</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleSelectAll} className="px-2 py-1 bg-surface-container-high rounded text-[11px] font-bold text-primary hover:bg-surface-container-highest transition-colors">Tất cả</button>
                    <button onClick={handleSelectPending} className="px-2 py-1 bg-surface-container-high rounded text-[11px] font-bold text-primary hover:bg-surface-container-highest transition-colors">Chưa dịch</button>
                    <button onClick={() => setSelectedChapters(new Set())} className="px-2 py-1 bg-surface-container-high rounded text-[11px] font-bold text-error hover:bg-surface-container-highest transition-colors">Bỏ chọn</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface-container-low p-2 rounded-lg border border-outline-variant/10">
                  <span className="text-[11px] text-on-surface-variant font-medium whitespace-nowrap">Từ chương:</span>
                  <input type="number" placeholder="..." value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="w-12 bg-surface px-1.5 py-1 rounded text-xs outline-none border border-transparent focus:border-primary/50 text-center text-on-surface" />
                  <span className="text-xs text-on-surface-variant">-</span>
                  <input type="number" placeholder="..." value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="w-12 bg-surface px-1.5 py-1 rounded text-xs outline-none border border-transparent focus:border-primary/50 text-center text-on-surface" />
                  <button onClick={handleSelectRange} className="text-[11px] ml-auto bg-primary text-on-primary px-3 py-1 rounded font-bold hover:bg-primary-fixed transition-colors">Chọn</button>
                </div>
              </div>
              <div ref={chapterListRef} onScroll={handleScroll} className="flex-1 overflow-y-auto hide-scrollbar flex flex-col p-0 border border-outline-variant/20 bg-surface rounded-xl min-h-[30vh] shadow-sm overflow-hidden">
                {[...chapters]
                  .sort((a, b) => a.chapterNumber - b.chapterNumber)
                  .filter(chap => !showOnlyPending || chap.state === 'PENDING' || chap.state === 'FAILED')
                  .map(chap => {
                    const isCurrentChapter = chap.chapterId === (initialSelectedChapters[0] || currentChapterId) || chap.chapterNumber === currentChapterNumber;
                    return (
                      <div 
                        key={chap.chapterId} 
                        id={`chapter-item-${chap.chapterNumber}`}
                        ref={isCurrentChapter ? activeItemRef : undefined}
                        onClick={() => toggleChapter(chap.chapterId)}
                        className={cn("group flex justify-between items-center px-3 py-2 cursor-pointer transition-colors border-b border-outline-variant/10 last:border-b-0 relative", selectedChapters.has(chap.chapterId) ? "bg-primary/5" : "bg-surface hover:bg-surface-container-lowest")}
                      >
                        {selectedChapters.has(chap.chapterId) && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                        <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1">
                          <div className={cn("shrink-0 w-8 h-8 rounded-full flex flex-col items-center justify-center font-bold tracking-tight border transition-colors", chap.state === 'SUCCEEDED' ? 'bg-primary/10 text-primary border-primary/20' : chap.state === 'PENDING' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20')}>
                            <span className="text-[7px] leading-none opacity-80 mt-[1px]">CH</span>
                            <span className="text-[11px] leading-none mt-[1px]">{chap.chapterNumber}</span>
                          </div>
                          
                          <div className="flex flex-col flex-1 truncate pr-2">
                            <span className={cn("text-[12px] sm:text-[13px] truncate font-medium transition-colors", selectedChapters.has(chap.chapterId) ? "text-primary font-bold" : "text-on-surface")}>{chap.title || `Chương ${chap.chapterNumber}`}</span>
                            {(chap.state === 'FAILED' || chap.state === 'PENDING') && <span className="text-[9px] text-warning/70 font-semibold mt-0.5">Chưa được dịch</span>}
                          </div>
                        </div>
                        {selectedChapters.has(chap.chapterId) ? <Check size={14} className="text-primary flex-shrink-0 drop-shadow-sm mr-1" /> : <Square size={14} className="text-on-surface-variant/30 flex-shrink-0 mr-1" />}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'story' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant sm:left-3.5" size={12} />
                <input 
                  type="text" 
                  placeholder="Tìm truyện..." 
                  value={searchBook}
                  onChange={(e) => setSearchBook(e.target.value)}
                  className="w-full bg-surface-container-highest border border-transparent rounded-xl py-2.5 sm:py-3 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm focus:outline-none focus:border-primary/50 focus:bg-surface transition-all placeholder:text-on-surface-variant/70"
                />
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col p-0 border border-outline-variant/20 bg-surface rounded-xl min-h-[30vh] shadow-sm overflow-hidden">
                {books.length === 0 ? (
                  <div className="py-12 text-center text-xs text-on-surface-variant/60 font-medium">
                    Không tìm thấy truyện nào trong thư viện
                  </div>
                ) : (
                  books
                    .filter((b) => b?.bookName && b.bookName.toLowerCase().includes((searchBook || '').toLowerCase()))
                    .map((book) => (
                      <div
                        key={book.bookId}
                        onClick={() => toggleBook(book.bookId)}
                        className={cn(
                          'group flex justify-between items-center px-3 py-2.5 cursor-pointer transition-colors border-b border-outline-variant/10 last:border-b-0 relative',
                          selectedBooks.has(book.bookId) ? 'bg-primary/5' : 'bg-surface hover:bg-surface-container-lowest'
                        )}
                      >
                        {selectedBooks.has(book.bookId) && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                        <div className="flex items-center gap-3 overflow-hidden pl-1">
                          <div
                            className={cn(
                              'flex flex-col items-center justify-center w-8 h-8 rounded-lg shrink-0 border transition-colors',
                              selectedBooks.has(book.bookId)
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-surface-container-highest border-transparent text-on-surface-variant'
                            )}
                          >
                            <Languages size={12} />
                          </div>
                          <span
                            className={cn(
                              'text-[12px] sm:text-[13px] truncate font-medium transition-colors',
                              selectedBooks.has(book.bookId) ? 'text-primary font-bold' : 'text-on-surface'
                            )}
                          >
                            {book.bookName}
                          </span>
                        </div>
                        {selectedBooks.has(book.bookId) ? (
                          <Check size={14} className="text-primary flex-shrink-0 drop-shadow-sm mr-1" />
                        ) : (
                          <Square size={14} className="text-on-surface-variant/30 flex-shrink-0 mr-1" />
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        
        {/* Action Button */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-outline-variant/30 bg-surface-container pb-safe">
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3 sm:py-4 bg-primary text-on-primary rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold font-sans flex items-center justify-center gap-2 hover:bg-primary-fixed active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader size={16} className="animate-spin sm:w-5 sm:h-5 text-on-primary" />
            ) : (
              <Sparkles size={16} className="fill-black/50 sm:w-5 sm:h-5" />
            )}
            
            {activeTab === 'current' ? (isSubmitting ? 'Đang Dịch...' : 'Dịch Ngay Chương Này') : 
             activeTab === 'batch_chapter' ? `Dịch ${selectedChapters.size} Chương Đã Chọn` : 
             `Dịch ${selectedBooks.size} Truyện Đã Chọn`}
          </button>
        </div>

      </div>
    </div>
  );
}

function TabButton({ active, children, onClick, disabled }: { active: boolean, children: React.ReactNode, onClick: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-[13px] font-bold rounded-lg transition-all duration-200 ${
        disabled 
          ? 'opacity-30 cursor-not-allowed bg-transparent text-on-surface-variant' 
          : active 
            ? 'bg-surface text-primary shadow-sm border border-outline-variant/10' 
            : 'text-on-surface-variant hover:text-on-surface border border-transparent cursor-pointer'
      }`}
    >
      {children}
    </button>
  );
}

