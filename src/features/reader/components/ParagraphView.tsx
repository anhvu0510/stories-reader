import React, { memo } from 'react';

interface ParagraphViewProps {
  content: string;
  index: number;
  isTTSActive?: boolean;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}

export const ParagraphView = memo(function ParagraphView({
  content,
  index,
  isTTSActive = false,
}: ParagraphViewProps) {
  return (
    <div
      data-paragraph-index={index}
      className={`mb-4 sm:mb-5 last:mb-2 text-justify leading-relaxed tracking-normal max-w-prose mx-auto text-on-background/95 font-medium hyphens-auto break-words select-text cursor-text selection:bg-primary/25 selection:text-primary transition-all duration-200 ${
        isTTSActive
          ? 'ring-2 ring-primary/60 bg-primary/10 rounded-2xl p-3 shadow-md backdrop-blur-[1px]'
          : ''
      }`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});
