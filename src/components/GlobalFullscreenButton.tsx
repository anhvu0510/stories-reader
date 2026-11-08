import { Maximize2 } from 'lucide-react';
import { motion } from 'motion/react';
import React, { memo } from 'react';

import { useFullscreen } from '@/hooks/useFullscreen';
import { triggerHaptic } from '@/hooks/useHaptic';
import { isAndroidApp } from '@/stores/useAppLockStore';

/**
 * Nút mở chế độ Toàn màn hình (Fullscreen) toàn cục cho trình duyệt Web.
 * Nằm gọn ở góc phải phía dưới, tự động ẩn hoàn toàn khi đã vào Fullscreen
 * (người dùng tự vuốt cạnh màn hình để thoát Fullscreen).
 */
export const GlobalFullscreenButton = memo(function GlobalFullscreenButton() {
	const { isFullscreen, isSupported, enterFullscreen } = useFullscreen();

	if (isAndroidApp() || !isSupported || isFullscreen) {
		return null;
	}

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
			className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)] right-3.5 z-40 w-8 h-8 rounded-full flex items-center justify-center bg-black/25 dark:bg-black/45 backdrop-blur-md border border-primary/45 text-primary/90 hover:text-primary hover:bg-primary/20 shadow-[0_4px_14px_rgba(0,0,0,0.4),_inset_0_1px_0.5px_rgba(255,255,255,0.35)] transition-all cursor-pointer select-none"
			title="Toàn màn hình"
			aria-label="Toàn màn hình"
		>
			<Maximize2 size={14} strokeWidth={2.3} />
		</motion.button>
	);
});
