import React, { useEffect, useState } from 'react';
import { downloadManager, DownloadTask } from '../lib/DownloadManager';

export function GlobalDownloadProgress() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    const updateTasks = () => setTasks(downloadManager.getTasks());
    updateTasks();
    const unsubscribe = downloadManager.subscribe(updateTasks);

    const handleAppRefresh = () => updateTasks();
    window.addEventListener('app-refresh', handleAppRefresh);
    window.addEventListener('download-queue-updated', handleAppRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('app-refresh', handleAppRefresh);
      window.removeEventListener('download-queue-updated', handleAppRefresh);
    };
  }, []);

  const downloadingTasks = tasks.filter(t => t.status === 'downloading' || t.status === 'waiting');

  if (downloadingTasks.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col pointer-events-none gap-1">
      {downloadingTasks.map(task => {
        const progressPercent = task.totalChapters > 0 
          ? Math.min(100, Math.round((task.completedChapters / task.totalChapters) * 100))
          : task.progress;

        return (
          <div key={task.bookId} className="w-full h-4 bg-surface-variant relative pointer-events-auto shadow-sm group">
             <div 
               className="absolute top-0 left-0 bottom-0 bg-primary/80 transition-all duration-300 ease-out" 
               style={{ width: `${progressPercent}%` }}
             />
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <span className="text-[10px] sm:text-[11px] font-bold text-on-surface drop-shadow-md truncate max-w-full px-2" style={{ textShadow: "0px 0px 2px rgba(255,255,255,0.8)" }}>
                 {task.bookName}: ({task.completedChapters} / {task.totalChapters || '?'}) - {progressPercent}%
               </span>
             </div>
          </div>
        );
      })}
    </div>
  );
}
