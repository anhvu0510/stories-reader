import { useCallback, useEffect, useState } from 'react';

/** Trả về trạng thái fullscreen hiện tại và hàm toggle.
 *  Chỉ hoạt động trên web (Fullscreen API không khả dụng trong WebView Android).
 */
export function useFullscreen() {
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const handler = () => {
			setIsFullscreen(Boolean(document.fullscreenElement));
		};
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	}, []);

	const enterFullscreen = useCallback(async () => {
		if (!document.documentElement.requestFullscreen) return;
		try {
			await document.documentElement.requestFullscreen();
		} catch {
			// Browser từ chối (e.g. permission policy) — bỏ qua
		}
	}, []);

	const exitFullscreen = useCallback(async () => {
		if (!document.exitFullscreen || !document.fullscreenElement) return;
		try {
			await document.exitFullscreen();
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
	const isSupported = typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;

	return { isFullscreen, isSupported, toggleFullscreen };
}
