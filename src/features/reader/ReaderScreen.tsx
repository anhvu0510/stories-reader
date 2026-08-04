import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChapterRepository } from '../../repositories/ChapterRepository';
import { ChapterContent } from '../../shared/types';
import { useReaderConfigStore } from '../../stores/useReaderConfigStore';
import { useAppStore } from '../../stores/useAppStore';
import { useToastStore } from '../../stores/useToastStore';
import { useTTSStore } from './stores/useTTSStore';
import { ReaderHeader } from './components/ReaderHeader';
import { ParagraphView } from './components/ParagraphView';
import { QuickReplacementModal } from './components/QuickReplacementModal';
import { ReaderQuickControl } from './components/ReaderQuickControl';
import { QuickTypographySheet } from './components/QuickTypographySheet';
import { QuickChapterSelectSheet } from './components/QuickChapterSelectSheet';
import { QuickBookHistorySheet } from './components/QuickBookHistorySheet';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { TranslationSheet } from '../../components/TranslationSheet';
import { GlobalSettingsSheet } from '../settings/GlobalSettingsSheet';
import { AlertCircle } from 'lucide-react';

interface ChapterContentSectionProps {
  chapterNumber: number;
  title: string;
  paragraphs: string[];
  fontSize: number;
  lineHeight: number;
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraphIndex: number;
  onDoubleClick: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}

// 100% Frozen & Memoized Chapter Content Section
const ChapterContentSection = memo(function ChapterContentSection({
  paragraphs,
  fontSize,
  lineHeight,
  isPlaying,
  isPaused,
  currentParagraphIndex,
  onDoubleClick,
  onClick,
}: ChapterContentSectionProps) {
  return (
    <main id="main-story-content" onClick={onClick}>
      <article className="px-4 pt-20 pb-5 space-y-3 select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        {paragraphs.map((paragraphHtml, index) => (
          <ParagraphView
            key={index}
            index={index}
            content={paragraphHtml}
            isTTSActive={(isPlaying || isPaused) && currentParagraphIndex === index}
            onDoubleClick={onDoubleClick}
          />
        ))}
      </article>
    </main>
  );
});

export function ReaderScreen() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const navigate = useNavigate();

  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const showToast = useToastStore((state) => state.showToast);

  // Store Selectors to prevent unnecessary re-renders
  const font = useReaderConfigStore((state) => state.font);
  const fontSize = useReaderConfigStore((state) => state.fontSize);
  const lineHeight = useReaderConfigStore((state) => state.lineHeight);
  const groupLines = useReaderConfigStore((state) => state.groupLines);
  const isEnabledReplace = useReaderConfigStore((state) => state.isEnabledReplace);

  const isPlaying = useTTSStore((state) => state.isPlaying);
  const isPaused = useTTSStore((state) => state.isPaused);
  const currentParagraphIndex = useTTSStore((state) => state.currentParagraphIndex);
  const setIsPlaying = useTTSStore((state) => state.setIsPlaying);
  const setIsPaused = useTTSStore((state) => state.setIsPaused);
  const resetTTS = useTTSStore((state) => state.resetTTS);

  const [contentData, setContentData] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showTranslateSheet, setShowTranslateSheet] = useState(false);
  const [showTypographySheet, setShowTypographySheet] = useState(false);
  const [showChapterSelectSheet, setShowChapterSelectSheet] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);

  // Zen Reader Mode: Dock controls show/hide state (Header stays ALWAYS VISIBLE)
  const [showZenControls, setShowZenControls] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lastScrollY = useRef(0);
  const scrollAnimRef = useRef<number | null>(null);

  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentPIdxRef = useRef(0);

  // Throttled & Smooth scroll progress listener for Dock & Progress bar
  useEffect(() => {
    const handleScroll = () => {
      if (scrollAnimRef.current !== null) return;
      scrollAnimRef.current = requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          const newProgress = (currentY / totalHeight) * 100;
          setScrollProgress((prev) => (Math.abs(prev - newProgress) > 0.5 ? newProgress : prev));

          // Auto show controls when user reaches bottom of page
          const isNearBottom = currentY >= totalHeight - 60 || newProgress >= 95;
          if (isNearBottom) {
            setShowZenControls(true);
            lastScrollY.current = currentY;
            scrollAnimRef.current = null;
            return;
          }
        }

        if (currentY > lastScrollY.current + 40 && currentY > 100) {
          setShowZenControls(false);
        } else if (currentY < lastScrollY.current - 20) {
          setShowZenControls(true);
        }
        lastScrollY.current = currentY;
        scrollAnimRef.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  // Tap/Click reading screen to toggle bottom dock control bar
  const handleArticleTap = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    setShowZenControls((prev) => !prev);
  }, []);

  // Fetch chapter data with guaranteed minimum loading delay for tactile feedback
  const loadChapter = useCallback(async () => {
    if (!chapterId) return;
    const MIN_LOADING_TIME = 400;
    const startTime = Date.now();
    setLoading(true);
    setError(null);
    try {
      const res = await ChapterRepository.getChapterContent(chapterId, groupLines, isEnabledReplace);
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime));
      }
      setContentData(res);
    } catch (e: any) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOADING_TIME) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME - elapsedTime));
      }
      setError(e.message || 'Lỗi khi tải nội dung chương');
    } finally {
      setLoading(false);
    }
  }, [chapterId, groupLines, isEnabledReplace]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    loadChapter();
    resetTTS();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [chapterId, loadChapter, resetTTS]);

  // Handle TTS Playback with smooth auto-scrolling
  const playTTSFromIndex = useCallback(
    (index: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !contentData?.chapter?.content) return;

      const paragraphs = contentData.chapter.content;
      if (index < 0 || index >= paragraphs.length) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        resetTTS();
        showToast('Đã đọc xong chương này', 'info');
        return;
      }

      window.speechSynthesis.cancel();
      currentPIdxRef.current = index;

      const rawText = paragraphs[index].replace(/<[^>]*>/g, '').trim();
      if (!rawText) {
        playTTSFromIndex(index + 1);
        return;
      }

      // Auto-scroll reading target paragraph smoothly into center of viewport
      const pElement = document.querySelector(`[data-paragraph-index="${index}"]`);
      if (pElement) {
        pElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const utterance = new SpeechSynthesisUtterance(rawText);
      utterance.lang = 'vi-VN';
      utterance.rate = useReaderConfigStore.getState().speechRate || 1.0;

      const voiceUri = useReaderConfigStore.getState().voiceUri;
      if (voiceUri) {
        const voices = window.speechSynthesis.getVoices();
        const foundVoice = voices.find((v) => v.voiceURI === voiceUri);
        if (foundVoice) utterance.voice = foundVoice;
      }

      utterance.onend = () => {
        playTTSFromIndex(index + 1);
      };

      utterance.onerror = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        resetTTS();
      };

      synthRef.current = utterance;
      useTTSStore.getState().setTTSPosition(index, 0, 0);
      setIsPlaying(true);
      setIsPaused(false);
      window.speechSynthesis.speak(utterance);
    },
    [contentData, resetTTS, setIsPlaying, setIsPaused, showToast]
  );

  const handleToggleTTS = useCallback(() => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
      setIsPaused(true);
    } else if (isPaused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else {
      playTTSFromIndex(0);
    }
  }, [isPlaying, isPaused, setIsPlaying, setIsPaused, playTTSFromIndex]);

  const handleStopTTS = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    resetTTS();
  }, [resetTTS]);

  // No-op double-click handler (Quick replacement popup removed, feature available in Settings)
  const handleDoubleClick = useCallback(() => {}, []);

  const handleOpenHistory = useCallback(() => setShowHistorySheet(true), []);
  const handleOpenChapterSelect = useCallback(() => setShowChapterSelectSheet(true), []);
  const handleOpenTranslation = useCallback(() => setShowTranslateSheet(true), []);

  const fontClass =
    font === 'font_viet_tay'
      ? 'font-mono'
      : font === 'default'
      ? 'font-sans'
      : 'font-serif';

  if (loading && !contentData) {
    return <LoadingOverlay isLoading={true} message="Đang mở văn bản..." />;
  }

  if (error || !contentData) {
    return (
      <div className="min-h-dvh w-full max-w-md mx-auto bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={40} className="text-error mb-3" />
        <h2 className="text-sm font-bold text-on-surface mb-1">Không thể tải chương</h2>
        <p className="text-xs text-on-surface-variant max-w-xs mb-5">{error || 'Chương không tồn tại'}</p>
        <button
          onClick={() => navigate(`/book/${bookId}`)}
          className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-extrabold"
        >
          Quay lại danh sách chương
        </button>
      </div>
    );
  }

  const { chapter, navigation } = contentData;

  return (
    <div
      className={`min-h-dvh w-full max-w-md mx-auto bg-background text-on-background pb-16 border-x border-outline-variant/20 shadow-2xl relative overflow-x-hidden transition-colors duration-200 ${fontClass}`}
    >
      {/* Smooth Non-Destructive Chapter Switching Loading Overlay */}
      <LoadingOverlay isLoading={loading} message="Đang mở văn bản..." />

      {/* Sticky Header - ALWAYS VISIBLE */}
      <div aria-hidden="true">
        <ReaderHeader
          bookId={bookId || ''}
          bookName={chapter.bookName}
          chapterNumber={chapter.chapterNumber}
          chapterTitle={chapter.title}
          progress={scrollProgress}
          isVisible={true}
          onOpenHistory={handleOpenHistory}
        />
      </div>

      {/* Reader Content Article - Frozen Memoized Section with Tap-to-Toggle Dock */}
      <ChapterContentSection
        paragraphs={chapter.content}
        fontSize={fontSize}
        lineHeight={lineHeight}
        isPlaying={isPlaying}
        isPaused={isPaused}
        currentParagraphIndex={currentParagraphIndex}
        onDoubleClick={handleDoubleClick}
        onClick={handleArticleTap}
      />

      {/* Single Capsule Zen Mode Floating Control Bar */}
      <div aria-hidden="true">
        <ReaderQuickControl
          bookId={bookId || ''}
          prevChapterId={navigation?.prev?.chapterId}
          nextChapterId={navigation?.next?.chapterId}
          currentChapterNumber={chapter.chapterNumber}
          isVisible={showZenControls}
          isTTSActive={isPlaying || isPaused}
          isTTSPlaying={isPlaying}
          currentParagraphIndex={currentParagraphIndex}
          onToggleTTS={handleToggleTTS}
          onTTSPlay={() => {
            if (isPaused) {
              window.speechSynthesis.resume();
              setIsPlaying(true);
              setIsPaused(false);
            } else {
              playTTSFromIndex(0);
            }
          }}
          onTTSPause={() => {
            window.speechSynthesis.pause();
            setIsPlaying(false);
            setIsPaused(true);
          }}
          onTTSStop={handleStopTTS}
          onTTSPrev={() => {
            const activeIdx = useTTSStore.getState().currentParagraphIndex >= 0 ? useTTSStore.getState().currentParagraphIndex : currentPIdxRef.current;
            playTTSFromIndex(Math.max(0, activeIdx - 1));
          }}
          onTTSNext={() => {
            const activeIdx = useTTSStore.getState().currentParagraphIndex >= 0 ? useTTSStore.getState().currentParagraphIndex : currentPIdxRef.current;
            playTTSFromIndex(activeIdx + 1);
          }}
          onOpenChapterSelect={handleOpenChapterSelect}
          onOpenTranslation={handleOpenTranslation}
        />
      </div>

      {/* Modals & Sheets (aria-hidden="true" for screen readers / read aloud tools) */}
      <div aria-hidden="true">
        <GlobalSettingsSheet currentBookId={bookId} currentChapterId={chapterId} />

        {showTypographySheet && (
          <QuickTypographySheet onClose={() => setShowTypographySheet(false)} />
        )}

        {showChapterSelectSheet && (
          <QuickChapterSelectSheet
            bookId={bookId || ''}
            currentChapterId={chapterId}
            currentChapterNumber={chapter.chapterNumber}
            onClose={() => setShowChapterSelectSheet(false)}
          />
        )}

        {showHistorySheet && (
          <QuickBookHistorySheet
            currentBookId={bookId}
            onClose={() => setShowHistorySheet(false)}
          />
        )}

        {showTranslateSheet && (
          <TranslationSheet
            currentBookId={bookId}
            currentChapterId={chapterId}
            currentChapterName={chapter.title}
            initialSelectedChapters={chapterId ? [chapterId] : []}
            onClose={() => setShowTranslateSheet(false)}
            onSuccess={loadChapter}
          />
        )}
      </div>
    </div>
  );
}
