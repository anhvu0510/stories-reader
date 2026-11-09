import { useEffect, useRef, useState } from 'react';

import type { ChapterDetailItem } from '@/shared/types';

interface UseScrollProgressProps {
	displayChapters: ChapterDetailItem[];
	activeChapter: { chapterId: string } | null;
	onNearBottom: () => void;
	onScrollVisibilityChange?: (visible: boolean) => void;
}

function resolveScrollVisibility(currentY: number, deltaY: number, lastVisible: boolean): boolean {
	if (currentY <= 60) return true;
	if (deltaY > 15) return false;
	if (deltaY < -15) return true;
	return lastVisible;
}

function checkIsNearBottom(currentY: number, totalHeight: number, newProgress: number, isLastChapterActive: boolean): boolean {
	if (!isLastChapterActive) return false;
	return currentY >= totalHeight - 40 || newProgress >= 98;
}

export function useScrollProgress({ displayChapters, activeChapter, onNearBottom, onScrollVisibilityChange }: UseScrollProgressProps) {
	const [scrollProgress, setScrollProgress] = useState(0);
	const lastScrollY = useRef(0);
	const lastVisibleRef = useRef(true);
	const isTickingRef = useRef(false);

	useEffect(() => {
		const handleScroll = () => {
			if (isTickingRef.current) return;
			isTickingRef.current = true;
			requestAnimationFrame(() => {
				isTickingRef.current = false;
				const currentY = window.scrollY;
				const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
				if (totalHeight > 0) {
					const newProgress = (currentY / totalHeight) * 100;
					setScrollProgress((prev) => (Math.abs(prev - newProgress) > 0.5 ? newProgress : prev));

					const lastChapter = displayChapters[displayChapters.length - 1];
					const isLastChapterActive = !lastChapter || !activeChapter || activeChapter.chapterId === lastChapter.chapterId;
					if (checkIsNearBottom(currentY, totalHeight, newProgress, isLastChapterActive)) {
						onNearBottom();
					}
				}

				const deltaY = currentY - lastScrollY.current;
				const nextVisible = resolveScrollVisibility(currentY, deltaY, lastVisibleRef.current);
				if (nextVisible !== lastVisibleRef.current) {
					lastVisibleRef.current = nextVisible;
					onScrollVisibilityChange?.(nextVisible);
				}

				lastScrollY.current = currentY;
			});
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	}, [displayChapters, activeChapter, onNearBottom, onScrollVisibilityChange]);

	return scrollProgress;
}
