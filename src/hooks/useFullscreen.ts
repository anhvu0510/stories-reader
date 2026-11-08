import { useCallback, useEffect, useState } from 'react';

/**
 * Kiểm tra trạng thái fullscreen của trình duyệt (hỗ trợ cả vendor prefixes).
 */
export function isBrowserFullscreen(): boolean {
	if (typeof document === 'undefined') return false;
	const doc = document as Document & {
		webkitFullscreenElement?: Element | null;
		mozFullScreenElement?: Element | null;
		msFullscreenElement?: Element | null;
	};
	return Boolean(document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
}

/**
 * Kiểm tra trạng thái fullscreen của trình duyệt (hỗ trợ cả vendor prefixes).
 */
export function isBrowserFullscreen(): boolean {
	if (typeof document === 'undefined') return false;
	const doc = document as Document & {
		webkitFullscreenElement?: Element | null;
		mozFullScreenElement?: Element | null;
		msFullscreenElement?: Element | null;
	};
	return Boolean(document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
}

/**
 * Trả về trạng thái fullscreen hiện tại và hàm toggle.
 *  Chỉ hoạt động trên web (Fullscreen API không khả dụng trong WebView Android).
 */
export function useFullscreen() {
	const [isFullscreen, setIsFullscreen] = useState(isBrowserFullscreen);

	useEffect(() => {
		const handler = () => {
			setIsFullscreen(isBrowserFullscreen());
		};
		document.addEventListener('fullscreenchange', handler);
		document.addEventListener('webkitfullscreenchange', handler);
		document.addEventListener('mozfullscreenchange', handler);
		document.addEventListener('MSFullscreenChange', handler);
		return () => {
			document.removeEventListener('fullscreenchange', handler);
			document.removeEventListener('webkitfullscreenchange', handler);
			document.removeEventListener('mozfullscreenchange', handler);
			document.removeEventListener('MSFullscreenChange', handler);
		};
	}, []);

	const enterFullscreen = useCallback(async () => {
		const docEl = document.documentElement as HTMLElement & {
			webkitRequestFullscreen?: () => Promise<void>;
			mozRequestFullScreen?: () => Promise<void>;
			msRequestFullscreen?: () => Promise<void>;
		};
		const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
		if (!req) return;
		try {
			await req.call(docEl);
		} catch {
			// Browser từ chối (e.g. permission policy) — bỏ qua
		}
	}, []);

	const exitFullscreen = useCallback(async () => {
		const doc = document as Document & {
			webkitExitFullscreen?: () => Promise<void>;
			mozCancelFullScreen?: () => Promise<void>;
			msExitFullscreen?: () => Promise<void>;
		};
		const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
		if (!exit || !doc.fullscreenElement) return;
		try {
			await exit.call(doc);
		} catch {
			// Bỏ qua lỗi khi không ở chế độ fullscreen
		}
	}, []);

	const toggleFullscreen = useCallback(() => {
		if (document.fullscreenElement) {
			exitFullscreen();
		} else {
			enterFullscreen();
		}
	}, [enterFullscreen, exitFullscreen]);

	/** True khi trình duyệt hỗ trợ Fullscreen API */
	const isSupported =
		typeof document !== 'undefined' &&
		Boolean(
			document.documentElement &&
			('requestFullscreen' in document.documentElement ||
				'webkitRequestFullscreen' in document.documentElement ||
				'mozRequestFullScreen' in document.documentElement ||
				'msRequestFullscreen' in document.documentElement)
		);

	return { isFullscreen, isSupported, toggleFullscreen };
}
