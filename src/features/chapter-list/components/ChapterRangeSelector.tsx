import React from 'react';

interface ChapterRangeSelectorProps {
  totalChapters: number;
  activeRange: string;
  onRangeSelect: (range: string, start?: number, end?: number) => void;
}

export function ChapterRangeSelector({ totalChapters, activeRange, onRangeSelect }: ChapterRangeSelectorProps) {
  if (totalChapters <= 100) return null;

  const chunkSize = 100;
  const chunksCount = Math.ceil(totalChapters / chunkSize);

  const ranges = Array.from({ length: chunksCount }, (_, i) => {
    const start = i * chunkSize + 1;
    const end = Math.min((i + 1) * chunkSize, totalChapters);
    return {
      label: `Chương ${start}-${end}`,
      value: `${start}-${end}`,
      start,
      end,
    };
  });

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
      <button
        onClick={() => onRangeSelect('all')}
        className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all flex-shrink-0 active:scale-95 ${
          activeRange === 'all'
            ? 'bg-amber-500 text-black font-extrabold shadow-sm'
            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
        }`}
      >
        Tất cả ({totalChapters})
      </button>

      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onRangeSelect(r.value, r.start, r.end)}
          className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all flex-shrink-0 active:scale-95 ${
            activeRange === r.value
              ? 'bg-amber-500 text-black font-extrabold shadow-sm'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
