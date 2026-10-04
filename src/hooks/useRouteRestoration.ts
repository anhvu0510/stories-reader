import { useEffect, useRef } from 'react';

export const STORAGE_KEY_LAST_ROUTE = 'stories_last_active_route';
export const ROUTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // Thời hạn khôi phục tối đa: 7 ngày

export interface UseRouteRestorationOptions {
	location: {
		pathname: string;
		search?: string;
		hash?: string;
	};
	navigate: (to: string, options?: { replace?: boolean }) => void;
	enabled?: boolean;
}

interface SavedRouteState {
	pathname: string;
	search?: string;
	hash?: string;
	timestamp: number;
}

/**
 * Hook quản lý cơ chế khôi phục trạng thái điều hướng khi App bị Kill hoặc Sleep:
 * 
 * Nghiệp vụ cốt lõi:
 * 1. Tự động lưu vết route hoạt động gần nhất vào localStorage mỗi khi chuyển trang.
 * 2. Lắng nghe sự kiện visibilitychange và pagehide: snapshot ngay route khi app chuẩn bị vào background/sleep.
 * 3. Khi mở lại App (Cold Start): nếu người dùng mở từ gốc ('/'), tự động khôi phục về trang đọc truyện dang dở.
 * 4. Nếu người dùng chủ động bấm quay về Thư viện ('/'), hệ thống tôn trọng ý định và không tự ý nhảy lại vào truyện.
 */
export function useRouteRestoration({
	location,
	navigate,
	enabled = true
}: UseRouteRestorationOptions) {
	const hasRestoredRef = useRef(false);
	const currentLocationRef = useRef(location);
	currentLocationRef.current = location;

	// 1. Phục hồi route gần nhất lúc khởi động app (chỉ chạy 1 lần duy nhất)
	useEffect(() => {
		if (!enabled || hasRestoredRef.current || typeof window === 'undefined') return;
		hasRestoredRef.current = true;

		// Chỉ khôi phục nếu app đang mở tại đường dẫn mặc định "/" (tránh ghi đè deep link của người dùng)
		const currentPath = location.pathname;
		if (currentPath !== '/' && currentPath !== '') {
			return;
		}

		try {
			const raw = localStorage.getItem(STORAGE_KEY_LAST_ROUTE);
			if (!raw) return;

			const saved: SavedRouteState = JSON.parse(raw);
			const isNotExpired = saved.timestamp && (Date.now() - saved.timestamp < ROUTE_MAX_AGE_MS);
			const isValidRoute = saved.pathname && saved.pathname !== '/';

			if (isValidRoute && isNotExpired) {
				const fullTarget = `${saved.pathname}${saved.search || ''}${saved.hash || ''}`;
				navigate(fullTarget, { replace: true });
			}
		} catch (err) {
			console.warn('[useRouteRestoration] Lỗi khi khôi phục trang gần nhất:', err);
		}
	}, [enabled, navigate, location.pathname]);

	// 2. Tự động lưu vết mỗi khi route thay đổi
	useEffect(() => {
		if (!enabled || typeof window === 'undefined') return;

		try {
			const routeState: SavedRouteState = {
				pathname: location.pathname,
				search: location.search || '',
				hash: location.hash || '',
				timestamp: Date.now()
			};
			localStorage.setItem(STORAGE_KEY_LAST_ROUTE, JSON.stringify(routeState));
		} catch (err) {
			console.warn('[useRouteRestoration] Không thể lưu vết route vào localStorage:', err);
		}
	}, [enabled, location.pathname, location.search, location.hash]);

	// 3. Lắng nghe vòng đời ứng dụng trên mobile: snapshot tức thì khi app chuyển sang background/sleep
	useEffect(() => {
		if (!enabled || typeof window === 'undefined') return;

		const handleSaveCurrentState = () => {
			if (!currentLocationRef.current) return;
			try {
				const loc = currentLocationRef.current;
				const routeState: SavedRouteState = {
					pathname: loc.pathname,
					search: loc.search || '',
					hash: loc.hash || '',
					timestamp: Date.now()
				};
				localStorage.setItem(STORAGE_KEY_LAST_ROUTE, JSON.stringify(routeState));
			} catch (err) {
				console.warn('[useRouteRestoration] Lỗi lưu trạng thái nền:', err);
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				handleSaveCurrentState();
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('pagehide', handleSaveCurrentState);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('pagehide', handleSaveCurrentState);
		};
	}, [enabled]);
}
