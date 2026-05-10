import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Book, Chapter, ChapterContent, Replacement } from './api';

interface ReaderDBSchema extends DBSchema {
  books: {
    key: string;
    value: Book;
  };
  chapters: {
    key: string; // chapterId
    value: Chapter & { bookId: string };
    indexes: { 'by-book': string };
  };
  chapterContents: {
    key: string; // chapterId
    value: ChapterContent;
  };
  replacements: {
    key: string;
    value: Replacement;
  };
}

let dbPromise: Promise<IDBPDatabase<ReaderDBSchema>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDBSchema>('reader-offline-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'bookId' });
        }
        if (!db.objectStoreNames.contains('chapters')) {
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'chapterId' });
          chapterStore.createIndex('by-book', 'bookId');
        }
        if (!db.objectStoreNames.contains('chapterContents')) {
          db.createObjectStore('chapterContents', { keyPath: 'chapter.chapterId' });
        }
        if (!db.objectStoreNames.contains('replacements')) {
          db.createObjectStore('replacements', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const offlineDb = {
  // Books
  async getBooks(): Promise<Book[]> {
    const db = await initDB();
    return await db.getAll('books');
  },
  async saveBook(book: Book) {
    const db = await initDB();
    await db.put('books', book);
  },
  async getBook(bookId: string): Promise<Book | undefined> {
    const db = await initDB();
    return await db.get('books', bookId);
  },
  async deleteBook(bookId: string) {
    const db = await initDB();
    
    // First find all related chapters
    const keys = await db.getAllKeysFromIndex('chapters', 'by-book', bookId);
    
    // Delete in chunks/separate transactions to avoid transaction inactivity
    const tx = db.transaction(['books', 'chapters', 'chapterContents'], 'readwrite');
    tx.objectStore('books').delete(bookId);
    
    const chapterStore = tx.objectStore('chapters');
    const chapterContentStore = tx.objectStore('chapterContents');
    
    for (const key of keys) {
      chapterStore.delete(key);
      chapterContentStore.delete(key);
    }
    
    await tx.done;
  },
  async deleteAllBooks() {
    const db = await initDB();
    const tx = db.transaction(['books', 'chapters', 'chapterContents', 'replacements'], 'readwrite');
    await tx.objectStore('books').clear();
    await tx.objectStore('chapters').clear();
    await tx.objectStore('chapterContents').clear();
    await tx.objectStore('replacements').clear();
    await tx.done;
  },

  // Chapters
  async getChapters(bookId: string): Promise<(Chapter & { bookId: string })[]> {
    const db = await initDB();
    return await db.getAllFromIndex('chapters', 'by-book', bookId);
  },
  async getChapterMeta(chapterId: string): Promise<(Chapter & { bookId: string }) | undefined> {
    const db = await initDB();
    return await db.get('chapters', chapterId);
  },
  async saveChapter(chapter: Chapter & { bookId: string }) {
    const db = await initDB();
    await db.put('chapters', chapter);
  },
  
  // Chapter Content
  async getChapterContent(chapterId: string): Promise<ChapterContent | undefined> {
    const db = await initDB();
    return await db.get('chapterContents', chapterId);
  },
  async saveChapterContent(content: ChapterContent) {
    const db = await initDB();
    await db.put('chapterContents', content);
  },

  // Replacements
  async getReplacements(): Promise<Replacement[]> {
    const db = await initDB();
    return await db.getAll('replacements');
  },
  async saveReplacement(replacement: Replacement) {
    const db = await initDB();
    await db.put('replacements', replacement);
  },
  async deleteReplacement(id: string) {
    const db = await initDB();
    await db.delete('replacements', id);
  },
  async clearReplacements() {
    const db = await initDB();
    await db.clear('replacements');
  }
};
