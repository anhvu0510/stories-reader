import { Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';
import React, { memo, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useFullscreen } from '@/hooks/useFullscreen';
import { triggerHaptic } from '@/hooks/useHaptic';
import { isAndroidApp } from '@/stores/useAppLockStore';

const SCROLL_THRESHOLD = 60;

/**
 * Nút fullscreen cho web, canh theo cột nội dung và đặt ngay dưới header.
 */
export const GlobalFullscreenButton = memo(function GlobalFullscreenButton() {
	const { isFullscreen, isSupported, enterFullscreen } = useFullscreen();
	const location = useLocation();
	const isLibrary = location.pathname === '/';
	const isReader = location.pathname.includes('/chapter/');
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		if (!isLibrary) return;
		const handleScroll = () => {
			setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();
		return () => window.removeEventListener('scroll', handleScroll);
	}, [isLibrary]);

	if (isAndroidApp() || !isSupported || isFullscreen) {
		return null;
	}

	const topOffsetClass =
		isLibrary && !isScrolled
			? 'top-[calc(max(env(safe-area-inset-top),0.5rem)+9.15rem)]'
			: 'top-[calc(max(env(safe-area-inset-top),0.5rem)+3.5rem)]';
	const rightOffsetClass = isReader
		? 'right-[max(1rem,env(safe-area-inset-right),calc((100vw_-_56rem)/2_+_1rem))] lg:right-[max(1rem,env(safe-area-inset-right),calc((100vw_-_80rem)/2_+_1rem))]'
		: 'right-[max(1rem,env(safe-area-inset-right),calc((100vw_-_28rem)/2_+_1rem))]';

	return (
		<motion.button
			type="button"
			data-testid="global-fullscreen-btn"
			whileTap={{ scale: 0.88 }}
			onClick={(e) => {
				e.stopPropagation();
				triggerHaptic('light');
				enterFullscreen();
			}}
			className={`fixed ${topOffsetClass} ${rightOffsetClass} z-30 flex h-11 w-11 flex-shrink-0 cursor-pointer select-none items-center justify-center rounded-2xl border border-outline-variant/60 bg-surface-container-high/90 text-on-surface shadow-lg shadow-black/20 backdrop-blur-md transition-[top,transform,background-color,border-color,box-shadow] duration-200 ease-out hover:border-primary/60 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95`}
			title="Bật toàn màn hình"
			aria-label="Bật toàn màn hình"
		>
			<Maximize2 size={18} strokeWidth={2} aria-hidden="true" />
		</motion.button>
	);
});
