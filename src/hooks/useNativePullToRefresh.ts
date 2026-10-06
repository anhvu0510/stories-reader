import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { UsePullToRefreshOptions, UsePullToRefreshReturn } from './usePullToRefresh';
import { configureNativeRefresh, finishNativeRefresh, hasNativeReaderGestures, onNativeReaderGesture, registerNativeGestureHitTest } from '@/services/nativeReaderGestures';
import { eligibleNativeTarget, isAtNativeScrollTop } from '@/services/nativeGestureEligibility';

export function useNativePullToRefresh({ onRefresh, enabled, disabled, threshold = 65, containerRef, targetRef }: UsePullToRefreshOptions): UsePullToRefreshReturn {
	const owner = useId();
	const latestRefresh = useRef(onRefresh);
	const busy = useRef(false);
	const mounted = useRef(false);
	const currentRequest = useRef<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
	useEffect(() => { latestRefresh.current = onRefresh; }, [onRefresh]);
	const supported = hasNativeReaderGestures() && enabled !== false && !disabled;
	useEffect(() => {
		if (!supported) return;
		let alive = true;
		const removeHitTest = registerNativeGestureHitTest('refresh', owner, (x, y) => {
			const target = eligibleNativeTarget(x, y);
			if (!target || busy.current) return false;
			if (targetRef?.current && !targetRef.current.contains(target)) return false;
			if (containerRef?.current && !containerRef.current.contains(target)) return false;
			return isAtNativeScrollTop(target);
		});
		const refresh = async (requestId: string) => {
			if (!alive || busy.current || !requestId.startsWith(`${owner}:`)) return;
			busy.current = true;
			currentRequest.current = requestId;
			setIsRefreshing(true);
			try {
				await latestRefresh.current();
			} catch (error) {
				console.error('[NativePullToRefresh] Refresh failed:', error);
			} finally {
				busy.current = false;
				currentRequest.current = null;
				if (mounted.current) setIsRefreshing(false);
				void finishNativeRefresh(owner, requestId).catch((error: unknown) => console.error('[NativePullToRefresh] Finish failed:', error));
			}
		};
		const unsubscribe = onNativeReaderGesture((gesture) => {
			if (gesture.kind === 'refresh') void refresh(gesture.requestId);
		});
		configureNativeRefresh({ enabled: true, owner, threshold });
		return () => {
			alive = false;
			removeHitTest();
			unsubscribe();
			configureNativeRefresh({ enabled: false, owner, threshold });
		};
	}, [supported, owner, threshold, containerRef, targetRef]);
	const reset = useCallback(() => {
		setIsRefreshing(false);
		configureNativeRefresh({ enabled: supported, owner, threshold });
		const requestId = currentRequest.current;
		if (!requestId) return;
		void finishNativeRefresh(owner, requestId).catch((error: unknown) => console.error('[NativePullToRefresh] Reset failed:', error));
	}, [owner, supported, threshold]);
	return { isRefreshing, pullDistance: 0, isPulling: false, hasTriggeredThreshold: false, progress: 0, reset };
}
