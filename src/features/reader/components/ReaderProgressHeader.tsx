import { useScrollProgress } from '../hooks/useScrollProgress';

import { ReaderHeader } from './ReaderHeader';

import type { ReaderHeaderProps } from './ReaderHeader';
import type { ChapterDetailItem } from '@/shared/types';

interface ReaderProgressHeaderProps extends Omit<ReaderHeaderProps, 'progress'> {
	displayChapters: ChapterDetailItem[];
	activeChapter: { chapterId: string } | null;
	onNearBottom: () => void;
	onScrollVisibilityChange: (visible: boolean) => void;
}

export function ReaderProgressHeader({
	displayChapters,
	activeChapter,
	onNearBottom,
	onScrollVisibilityChange,
	...headerProps
}: ReaderProgressHeaderProps) {
	const progress = useScrollProgress({
		displayChapters,
		activeChapter,
		onNearBottom,
		onScrollVisibilityChange,
	});

	return <ReaderHeader {...headerProps} progress={progress} />;
}
