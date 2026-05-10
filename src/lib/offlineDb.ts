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
    const content = await db.get('chapterContents', chapterId);
    if (!content) return undefined;

    // Decompress if compressed
    if (content.chapter.compressedContent) {
      try {
        const stream = new Blob([content.chapter.compressedContent]).stream().pipeThrough(new DecompressionStream('deflate'));
        const response = new Response(stream);
        const blob = await response.blob();
        const jsonStr = await blob.text();
        content.chapter.content = JSON.parse(jsonStr);
        delete content.chapter.compressedContent;
      } catch (e) {
        console.error("Decompression failed", e);
        content.chapter.content = [];
      }
    }

    return content;
  },
  async saveChapterContent(content: ChapterContent) {
    const db = await initDB();
    
    // Create a copy to modify
    const contentToSave = JSON.parse(JSON.stringify(content));
    
    // Compress content if available
    if (contentToSave.chapter.content && contentToSave.chapter.content.length > 0) {
      try {
        const jsonStr = JSON.stringify(contentToSave.chapter.content);
        if (window.CompressionStream) {
          const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate'));
          const response = new Response(stream);
          const buffer = await response.arrayBuffer();
          
          contentToSave.chapter.compressedContent = new Uint8Array(buffer);
          delete contentToSave.chapter.content; // Free up space
        }
      } catch (e) {
        console.warn("Compression failed, saving as raw", e);
      }
    }

    await db.put('chapterContents', contentToSave);
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
  },

  // Utilities
  async getDbSize(): Promise<number> {
    const db = await initDB();
    let size = 0;
    
    try {
      // Books
      const books = await db.getAll('books');
      size += JSON.stringify(books).length;
      
      // Chapters metadata
      const chapters = await db.getAll('chapters');
      size += JSON.stringify(chapters).length;
      
      // Chapter Contents (large, use cursor)
      let cursor = await db.transaction('chapterContents').store.openCursor();
      while (cursor) {
        const val = cursor.value;
        if (val.chapter && val.chapter.compressedContent) {
          size += val.chapter.compressedContent.byteLength;
          // Add roughly the rest of the metadata size
          const meta = { ...val };
          delete meta.chapter.compressedContent;
          size += JSON.stringify(meta).length;
        } else {
          size += JSON.stringify(val).length;
        }
        cursor = await cursor.continue();
      }
    } catch (e) {
      console.error("Failed to calculate DB size", e);
    }
    
    return size;
  }
};
