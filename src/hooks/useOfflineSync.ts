import { useState } from 'react';
import { api, Book, Chapter } from '../lib/api';
import { offlineDb } from '../lib/offlineDb';

export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncingBookId, setSyncingBookId] = useState<string | null>(null);
  
  const syncBookFlow = async (bookId: string, bookIndex: number, totalBooks: number) => {
    setSyncingBookId(bookId);
    const bookLabel = totalBooks > 1 ? ` (Truyện ${bookIndex}/${totalBooks})` : '';
    setSyncStatus(`Đang lấy thông tin${bookLabel}...`);
    
    // 1. Lấy thông tin truyện
    const { data: books } = await api.getBooks(1, '', undefined, 1000, 'online');
    const book = books.find(b => b.bookId === bookId);
    if (!book) throw new Error("Không tìm thấy truyện");
    
    await offlineDb.saveBook(book);
    
    // 2. Lấy danh sách chương
    setSyncStatus(`Đang lấy danh sách chương${bookLabel}...`);
    let page = 1;
    const allChapters: Chapter[] = [];
    while (true) {
      const res = await api.getChapters(bookId, page, 100);
      allChapters.push(...res.chapters);
      if (page >= res.pagination.totalPages) break;
      page++;
    }
    
    for (const chap of allChapters) {
      await offlineDb.saveChapter({ ...chap, bookId });
    }
    
    // 3. Tải nội dung từng chương
    setSyncStatus(`Đang tải nội dung${bookLabel}...`);
    let completed = 0;
    
    const CHUNK_SIZE = 5;
    for (let i = 0; i < allChapters.length; i += CHUNK_SIZE) {
      const chunk = allChapters.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (chap) => {
        try {
          // Temporarily disable offline mode for content fetch
          const isOfflineBackup = localStorage.getItem('offlineMode');
          localStorage.setItem('offlineMode', 'false');
          const content = await api.getChapterContent(chap.chapterId, 1, false);
          if (isOfflineBackup) localStorage.setItem('offlineMode', isOfflineBackup);
          await offlineDb.saveChapterContent(content);
        } catch(e) {
           console.log("Error loading content for chapter", chap.chapterId, e);
        }
        completed++;
        setSyncProgress(Math.round((completed / allChapters.length) * 100));
      }));
    }
    
    // 4. Lưu Replacements
    setSyncStatus(`Đang tải cấu hình AI${bookLabel}...`);
    const isOfflineBackup = localStorage.getItem('offlineMode');
    localStorage.setItem('offlineMode', 'false');
    const reps = await api.getReplacements(bookId);
    if (isOfflineBackup) localStorage.setItem('offlineMode', isOfflineBackup);
    for (const rep of reps.data) {
      await offlineDb.saveReplacement(rep);
    }
  };

  const syncMultipleBooks = async (bookIds: string[]) => {
    setIsSyncing(true);
    setSyncProgress(0);
    
    try {
      for (let i = 0; i < bookIds.length; i++) {
        await syncBookFlow(bookIds[i], i + 1, bookIds.length);
      }
      
      setSyncStatus('Hoàn thành tất cả!');
      setTimeout(() => {
        setIsSyncing(false);
        setSyncingBookId(null);
      }, 2000);
    } catch (e: any) {
      setSyncStatus(`Lỗi: ${e.message}`);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncingBookId(null);
      }, 3000);
    }
  };
  
  const syncBook = async (bookId: string) => {
    return syncMultipleBooks([bookId]);
  };

  return { isSyncing, syncProgress, syncStatus, syncBook, syncMultipleBooks, syncingBookId };
}
