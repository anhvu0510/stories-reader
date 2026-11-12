import React, { memo, useMemo } from 'react';

import { sanitizeParagraphHtml } from '../utils/readerHelpers';

interface ParagraphViewProps {
	content: string;
	index: number;
	isTTSActive?: boolean;
	onDoubleClick?: (e: React.MouseEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

export const ParagraphView = memo(
	function ParagraphView({ content, index }: ParagraphViewProps) {
		const cleanHtml = useMemo(() => sanitizeParagraphHtml(content), [content]);

		if (!cleanHtml) return null;

		return (
			<div
				data-paragraph-index={index}
				className="mb-4 sm:mb-5 last:mb-2 text-justify leading-[inherit] tracking-normal w-full text-on-background/95 font-medium hyphens-auto break-words select-text cursor-text selection:bg-primary/25 selection:text-primary"
				dangerouslySetInnerHTML={{ __html: cleanHtml }}
			/>
		);
	},
	(previous, next) => previous.content === next.content && previous.index === next.index
);
