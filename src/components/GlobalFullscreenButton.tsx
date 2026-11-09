import { Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';
import React, { memo, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useFullscreen } from '@/hooks/useFullscreen';
import { triggerHaptic } from '@/hooks/useHaptic';
import { isAndroidApp } from '@/stores/useAppLockStore';

const SCROLL_THRESHOLD = 60;

/**
 * Nút mở chế độ Toàn màn hình (Fullscreen) toàn cục cho trình duyệt Web.
 * Thiết kế khối cầu kính 3D mờ cao cấp, cố định ngay dưới Header bên góc phải.
 * Tự động ẩn hoàn toàn khi đã vào Fullscreen (người dùng vuốt cạnh để thoát).
 */
export const GlobalFullscreenButton = memo(function GlobalFullscreenButton() {
	const { isFullscreen, isSupported, enterFullscreen } = useFullscreen();
	const location = useLocation();
	const isLibrary = location.pathname === '/';
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
			className={`fixed ${topOffsetClass} right-3.5 z-30 w-8 h-8 rounded-full bg-gradient-to-b from-white/20 via-white/10 to-white/5 dark:from-white/15 dark:via-white/5 dark:to-black/30 border border-white/35 dark:border-white/20 text-primary hover:from-white/25 hover:to-white/10 hover:border-primary/50 shadow-[0_4px_14px_rgba(0,0,0,0.35),_inset_0_1px_1px_0_rgba(255,255,255,0.45),_inset_0_-1px_1px_0_rgba(0,0,0,0.35)] transition-[top,opacity,transform] duration-250 ease-out flex items-center justify-center flex-shrink-0 cursor-pointer select-none`}
			title="Toàn màn hình"
			aria-label="Toàn màn hình"
		>
			<Maximize2 size={15} strokeWidth={2.3} className="drop-shadow-[0_1px_3px_rgba(245,158,11,0.45)]" />
		</motion.button>
	);
});
