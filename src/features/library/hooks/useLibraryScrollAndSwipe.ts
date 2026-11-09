import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';

import { useSwipeGesture } from '@/hooks/useSwipeGesture';

export const TABS: readonly ['ALL', 'HISTORY', 'FAVORITE', 'AI'] = ['ALL', 'HISTORY', 'FAVORITE', 'AI'] as const;
export type LibraryTab = (typeof TABS)[number];

export function resetScrollTop() {
	if (typeof window !== 'undefined') {
		window.scrollTo({ top: 0, behavior: 'instant' });
	}
}

export function useRestoreScrollOnLoad(loading: boolean, hasBooks: boolean, savedScrollY: number) {
	const isRestoredRef = useRef(false);
	useEffect(() => {
		if (!loading && hasBooks && !isRestoredRef.current) {
			isRestoredRef.current = true;
			if (typeof window !== 'undefined') {
				if (savedScrollY > 0) {
					requestAnimationFrame(() => {
						window.scrollTo({ top: savedScrollY, behavior: 'instant' });
					});
				} else {
					window.scrollTo({ top: 0, behavior: 'instant' });
				}
			}
		}
	}, [loading, hasBooks, savedScrollY]);
}

export function useLibrarySwipeTabs({
	tab,
	disabled,
	onTabChange,
	contentContainerRef,
}: {
	tab: LibraryTab;
	disabled: boolean;
	onTabChange: (newTab: LibraryTab) => void;
	contentContainerRef: RefObject<HTMLDivElement | null>;
}) {
	const handleSwipeLeft = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex < TABS.length - 1) {
			onTabChange(TABS[currentIndex + 1]);
		}
	}, [tab, onTabChange]);

	const handleSwipeRight = useCallback(() => {
		const currentIndex = TABS.indexOf(tab);
		if (currentIndex > 0) {
			onTabChange(TABS[currentIndex - 1]);
		}
	}, [tab, onTabChange]);

	const handleDragStart = useCallback(() => {
		if (contentContainerRef.current) {
			contentContainerRef.current.style.transition = 'none';
		}
	}, [contentContainerRef]);

	const handleDragMove = useCallback(
		(offset: number) => {
			if (!contentContainerRef.current) return;
			const currentIndex = TABS.indexOf(tab);
			let effectiveOffset = offset;
			if ((currentIndex === 0 && offset > 0) || (currentIndex === TABS.length - 1 && offset < 0)) {
				effectiveOffset = offset * 0.25;
			}
			contentContainerRef.current.style.transform = `translate3d(${effectiveOffset}px, 0, 0)`;
		},
		[tab, contentContainerRef]
	);

	const handleDragEnd = useCallback(() => {
		if (!contentContainerRef.current) return;
		contentContainerRef.current.style.transition = 'transform 240ms cubic-bezier(0.2, 0, 0, 1)';
		contentContainerRef.current.style.transform = 'translate3d(0px, 0, 0)';
	}, [contentContainerRef]);

	useSwipeGesture({
		onSwipeLeft: handleSwipeLeft,
		onSwipeRight: handleSwipeRight,
		onDragStart: handleDragStart,
		onDragMove: handleDragMove,
		onDragEnd: handleDragEnd,
		threshold: 70,
		minVelocity: 0.45,
		disabled,
	});
}

function isSearchInputFocused(): boolean {
	if (typeof document === 'undefined') return false;
	return document.activeElement?.tagName === 'INPUT';
}

function shouldCollapseHeader(currentY: number, deltaY: number): boolean {
	if (isSearchInputFocused()) return false;
	return currentY > 80 && deltaY > 12;
}

function shouldExpandHeader(currentY: number, deltaY: number): boolean {
	return deltaY < -10 || currentY <= 48;
}

export function useLibraryScrollHeader({ loading, setSavedScrollY }: { loading: boolean; setSavedScrollY: (scrollY: number) => void }) {
	const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
	const [headerCollapseOffset, setHeaderCollapseOffset] = useState(96);
	const headerContentRef = useRef<HTMLDivElement | null>(null);
	const lastScrollYRef = useRef(0);
	const saveScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const el = headerContentRef.current;
		if (!el) return;
		const measured = el.offsetHeight;
		if (measured > 0) {
			setHeaderCollapseOffset(measured);
		}
	}, []);

	useEffect(() => {
		const handleScroll = () => {
			const currentY = Math.max(0, window.scrollY || 0);
			const deltaY = currentY - lastScrollYRef.current;

			if (shouldCollapseHeader(currentY, deltaY)) {
				setIsHeaderCollapsed(true);
				lastScrollYRef.current = currentY;
			} else if (shouldExpandHeader(currentY, deltaY)) {
				setIsHeaderCollapsed(false);
				lastScrollYRef.current = currentY;
			}

			if (loading) return;
			if (saveScrollTimeoutRef.current) clearTimeout(saveScrollTimeoutRef.current);
			saveScrollTimeoutRef.current = setTimeout(() => {
				setSavedScrollY(currentY);
			}, 150);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (saveScrollTimeoutRef.current) clearTimeout(saveScrollTimeoutRef.current);
		};
	}, [loading, setSavedScrollY]);

	return {
		isHeaderCollapsed,
		setIsHeaderCollapsed,
		headerCollapseOffset,
		headerContentRef,
	};
}
