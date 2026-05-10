import React, { useEffect, useState } from 'react';
import { downloadManager, DownloadTask } from '../lib/DownloadManager';

export function GlobalDownloadProgress() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const updateTasks = () => {
      setTasks(downloadManager.getTasks());
      setTick(t => t + 1);
    };
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
  
  const batchTotal = downloadManager.batchTotal;
  const batchCompleted = downloadManager.batchCompleted;

  if (downloadingTasks.length === 0) return null;

  let progressPercent = 0;
  let textLeft = "";
  let textRight = "";

  if (batchTotal <= 1 && downloadingTasks.length === 1) {
    const task = downloadingTasks[0];
    progressPercent = task.totalChapters > 0 
      ? Math.min(100, Math.round((task.completedChapters / Math.max(1, task.totalChapters)) * 100))
      : task.progress;
    textLeft = task.bookName || 'Đang tải...';
    textRight = `${task.completedChapters} / ${task.totalChapters || '?'} chương`;
  } else {
    // Multiple books
    const activeProgressSum = downloadingTasks.reduce((acc, t) => {
      if (t.status === 'waiting') return acc;
      const p = t.totalChapters > 0 ? (t.completedChapters / Math.max(1, t.totalChapters)) : (t.progress / 100);
      return acc + p;
    }, 0);
    
    progressPercent = Math.min(100, Math.round(((batchCompleted + activeProgressSum) / Math.max(1, batchTotal)) * 100));
    textLeft = downloadManager.lastProcessedBookName 
      ? `Đã tải: ${downloadManager.lastProcessedBookName}` 
      : `Đang tải...`;
    textRight = `${batchCompleted} / ${batchTotal} truyện`;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col pointer-events-none drop-shadow-md bg-surface-variant/90 backdrop-blur-sm border-b border-outline-variant/30">
      <div className="w-full h-7 sm:h-8 relative pointer-events-auto shadow-sm group">
         <div 
           className="absolute top-0 left-0 bottom-0 bg-primary/70 transition-all duration-300 ease-out" 
           style={{ width: `${progressPercent}%` }}
         />
         <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-3 sm:px-4 w-full">
           <span className="text-[11px] sm:text-[13px] font-bold text-on-surface truncate flex-1 min-w-0" style={{ textShadow: "0px 0px 2px rgba(255,255,255,0.9)" }}>
             {textLeft}
           </span>
           <span className="text-[11px] sm:text-[13px] font-bold text-on-surface whitespace-nowrap shrink-0 pl-3" style={{ textShadow: "0px 0px 2px rgba(255,255,255,0.9)" }}>
             {textRight} - {progressPercent}%
           </span>
         </div>
      </div>
    </div>
  );
}
