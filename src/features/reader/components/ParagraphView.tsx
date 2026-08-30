import React, { memo } from 'react';

interface ParagraphViewProps {
  content: string;
  index: number;
  isTTSActive?: boolean;
  onDoubleClick: (e: React.MouseEvent) => void;
}

export const ParagraphView = memo(function ParagraphView({ content, index, isTTSActive = false, onDoubleClick }: ParagraphViewProps) {
  return (
    <div
      data-paragraph-index={index}
      onDoubleClick={onDoubleClick}
      className={`mb-4 last:mb-1 text-justify leading-relaxed tracking-normal max-w-prose mx-auto text-on-background/95 font-medium hyphens-auto break-words select-text cursor-text transition-all duration-200 ${
        isTTSActive
          ? 'ring-2 ring-primary/60 bg-primary/10 rounded-2xl p-3 shadow-md'
          : ''
      }`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});
