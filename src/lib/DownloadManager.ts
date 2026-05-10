import { api, Book, Chapter } from './api';
import { offlineDb } from './offlineDb';
import oboe from 'oboe';
import { getActiveDomain } from './api';

export type DownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error';

export interface DownloadTask {
  bookId: string;
  bookName: string;
  status: DownloadStatus;
  progress: number;
  totalChapters: number;
  completedChapters: number;
  error?: string;
}

type Listener = () => void;

class DownloadManager {
  private queue: string[] = [];
  private tasks: Map<string, DownloadTask> = new Map();
  private activeCount: number = 0;
  private concurrency: number = 2; // Process 2 books at a time
  private listeners: Set<Listener> = new Set();
  private stopMap: Map<string, boolean> = new Map();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
    // Also dispatch global event for older components if needed
    window.dispatchEvent(new CustomEvent('download-queue-updated'));
  }

  getTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(bookId: string): DownloadTask | undefined {
    return this.tasks.get(bookId);
  }

  addBook(bookId: string, bookName: string = 'Đang tải...') {
    if (this.tasks.has(bookId)) {
      const task = this.tasks.get(bookId)!;
      if (task.status === 'downloading' || task.status === 'waiting') {
        return; // already in queue
      }
    }

    const newTask: DownloadTask = {
      bookId,
      bookName,
      status: 'waiting',
      progress: 0,
      totalChapters: 0,
      completedChapters: 0,
    };
    
    this.tasks.set(bookId, newTask);
    this.queue.push(bookId);
    this.stopMap.set(bookId, false);
    
    this.notify();
    this.processQueue();
  }

  cancelBook(bookId: string) {
    this.stopMap.set(bookId, true);
    if (this.tasks.has(bookId)) {
      const task = this.tasks.get(bookId)!;
      if (task.status === 'waiting') {
        this.queue = this.queue.filter(id => id !== bookId);
        this.tasks.delete(bookId);
      }
      this.notify();
    }
  }

  private async processQueue() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const bookId = this.queue.shift()!;
    if (this.stopMap.get(bookId)) {
      this.tasks.delete(bookId);
      this.stopMap.delete(bookId);
      this.notify();
      this.processQueue();
      return;
    }

    this.activeCount++;
    const task = this.tasks.get(bookId)!;
    task.status = 'downloading';
    this.notify();

    try {
      await this.downloadBookFlow(task);
      task.status = 'completed';
      window.dispatchEvent(new CustomEvent('app-toast', { 
        detail: { message: `Đã tải xong: ${task.bookName}`, type: 'success' }
      }));
      this.tasks.delete(bookId);
      this.notify();
    } catch (e: any) {
      task.status = 'error';
      task.error = e.message;
      window.dispatchEvent(new CustomEvent('app-toast', { 
        detail: { message: `Lỗi tải ${task.bookName}. Đã lưu ${task.completedChapters}/${task.totalChapters} chương.`, type: 'error' }
      }));
      this.tasks.delete(bookId);
      this.notify();
    } finally {
      this.activeCount--;
      this.notify();
      
      // dispatch success to reload ui
      window.dispatchEvent(new CustomEvent('app-refresh'));

      this.processQueue();
    }
  }

  private async downloadBookFlow(task: DownloadTask) {
    const isOfflineBackup = localStorage.getItem('offlineMode');
    localStorage.setItem('offlineMode', 'false');

    try {
      task.progress = 5;
      this.notify();

      if (this.stopMap.get(task.bookId)) throw new Error("Đã hủy");

      const domain = getActiveDomain();
      if (!domain) {
        throw new Error("Không có kết nối API. Vui lòng cấu hình API Domain.");
      }

      await new Promise<void>((resolve, reject) => {
        let isBookSaved = false;
        let bookSavePromise: Promise<void> | null = null;
        let chapterPromises: Promise<any>[] = [];

        const stream = oboe({
          url: `${domain.url}/api/books/download`,
          method: 'POST',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bookIds: [task.bookId] }),
          cached: false
        })
        .node('data.*.book', (book: any) => {
          task.bookName = book.bookName;
          task.totalChapters = book.chapterCount;
          task.progress = 5;
          this.notify();
          
          bookSavePromise = offlineDb.saveBook(book).then(() => {
            isBookSaved = true;
          });
          
          return oboe.drop;
        })
        .node('data.*.chapters.*', (chap: any) => {
          if (this.stopMap.get(task.bookId)) {
            stream.abort();
            reject(new Error("Đã hủy"));
            return oboe.drop;
          }

          // We wait for the book logic to complete if needed, but since offlineDb handles independent objects, we can just save.
          const saveAction = async () => {
             if (bookSavePromise && !isBookSaved) {
               await bookSavePromise;
             }
             await offlineDb.saveChapter({ ...chap, bookId: task.bookId, content: undefined });
             const content = {
               chapter: {
                 chapterId: chap.chapterId,
                 chapterNumber: chap.chapterNumber,
                 title: chap.title,
                 bookName: chap.bookName || task.bookName,
                 state: chap.state || 'translated',
                 totalTokens: chap.totalTokens || 0,
                 content: chap.content || [],
                 rootTab: chap.rootTab || ''
               }
             };
             await offlineDb.saveChapterContent(content);
             
             task.completedChapters++;
             task.progress = 5 + Math.round((task.completedChapters / Math.max(1, task.totalChapters)) * 90);
             this.notify();
          };

          chapterPromises.push(saveAction());

          // To prevent taking up too much memory, we discard the parsed chapter node
          return oboe.drop;
        })
        .done(async () => {
          try {
            await Promise.all(chapterPromises);
            resolve();
          } catch (e) {
            reject(e);
          }
        })
        .fail((err: any) => {
           if (this.stopMap.get(task.bookId)) {
             reject(new Error("Đã hủy"));
           } else {
             reject(new Error("Lỗi luồng dữ liệu (Stream Error): " + (err.error?.message || err.statusCode || "Unknown")));
           }
        });
      });

      if (this.stopMap.get(task.bookId)) throw new Error("Đã hủy");
      
      task.progress = 100;
      this.notify();

    } finally {
      if (isOfflineBackup) {
        localStorage.setItem('offlineMode', isOfflineBackup);
      }
    }
  }
}

export const downloadManager = new DownloadManager();
