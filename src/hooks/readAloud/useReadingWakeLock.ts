import { useCallback, useEffect, useRef } from 'react';

export function useReadingWakeLock() {
	const lock = useRef<WakeLockSentinel | null>(null);
	const generation = useRef(0);
	const pending = useRef<number | null>(null);
	const requestWakeLock = useCallback(async () => {
		if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
		if (lock.current && !lock.current.released) return;
		if (pending.current !== null) return;
		const requestId = ++generation.current;
		pending.current = requestId;
		try {
			const acquired = await navigator.wakeLock.request('screen');
			if (requestId !== generation.current) {
				await acquired.release();
				return;
			}
			lock.current = acquired;
		} catch (error) {
			console.debug('[ReadAloud] Screen wake lock unavailable:', error);
		} finally {
			if (pending.current === requestId) pending.current = null;
		}
	}, []);
	const releaseWakeLock = useCallback(() => {
		generation.current += 1;
		pending.current = null;
		const active = lock.current;
		lock.current = null;
		if (active) void active.release().catch((error: unknown) => console.debug('[ReadAloud] Wake lock release failed:', error));
	}, []);
	useEffect(() => releaseWakeLock, [releaseWakeLock]);
	return { requestWakeLock, releaseWakeLock };
}
