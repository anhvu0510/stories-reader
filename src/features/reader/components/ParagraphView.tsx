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
}: ParagraphViewProps) {
  return (
    <div
      data-paragraph-index={index}
      className="mb-4 sm:mb-5 last:mb-2 text-justify leading-relaxed tracking-normal max-w-prose mx-auto text-on-background/95 font-medium hyphens-auto break-words select-text cursor-text selection:bg-primary/25 selection:text-primary"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});
