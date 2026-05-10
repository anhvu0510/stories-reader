import { useState, useEffect } from 'react';
import { downloadManager, DownloadTask } from '../lib/DownloadManager';

export function useOfflineSync() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    const handleUpdate = () => {
      setTasks(downloadManager.getTasks());
    };
    
    const unsubscribe = downloadManager.subscribe(handleUpdate);
    handleUpdate(); // Initial load
    
    return () => unsubscribe();
  }, []);

  const syncBook = (bookId: string, bookName?: string) => {
    downloadManager.addBook(bookId, bookName);
  };

  const syncMultipleBooks = (bookIds: string[]) => {
    for (const id of bookIds) {
      downloadManager.addBook(id);
    }
  };
  
  const getTask = (bookId: string) => {
    return tasks.find(t => t.bookId === bookId);
  };

  const cancelSync = (bookId: string) => {
    downloadManager.cancelBook(bookId);
  };

  // We keep backward compatibility properties as much as possible for generic use, 
  // but it's better if components read `tasks` or `getTask`.
  const isSyncing = tasks.some(t => t.status === 'downloading');

  return { 
    isSyncing, 
    tasks,
    getTask,
    syncBook, 
    syncMultipleBooks,
    cancelSync
  };
}
