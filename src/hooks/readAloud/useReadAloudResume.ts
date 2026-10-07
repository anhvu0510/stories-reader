import { useCallback, useEffect } from 'react';

export interface ReadAloudResumePosition {
	chunkIndex: number;
	charOffset: number;
	paragraphIndex?: number;
	sourceOffset?: number;
	version?: 2;
}

export function useReadAloudResume(chapterId?: string) {
	const getResumePosition = useCallback((): ReadAloudResumePosition | null => {
		if (!chapterId || typeof window === 'undefined') return null;
		try {
			const saved = localStorage.getItem(`stories_tts_pos_${chapterId}`);
			if (!saved) return null;
			const parsed = JSON.parse(saved);
			if (typeof parsed.chunkIndex === 'number' && parsed.chunkIndex >= 0) {
				return parsed;
			}
		} catch {}
		return null;
	}, [chapterId]);

	const saveResumePosition = useCallback(
		(chunkIndex: number, charOffset: number, paragraphIndex?: number, sourceOffset?: number) => {
			if (!chapterId || typeof window === 'undefined') return;
			try {
				const position: ReadAloudResumePosition = { chunkIndex, charOffset };
				if (paragraphIndex !== undefined && sourceOffset !== undefined) {
					position.paragraphIndex = paragraphIndex;
					position.sourceOffset = sourceOffset;
					position.version = 2;
				}
				localStorage.setItem(`stories_tts_pos_${chapterId}`, JSON.stringify(position));
			} catch {}
		},
		[chapterId]
	);

	const clearResumePosition = useCallback(() => {
		if (!chapterId || typeof window === 'undefined') return;
		try {
			localStorage.removeItem(`stories_tts_pos_${chapterId}`);
		} catch {}
	}, [chapterId]);

	const clearAllStaleResumePositions = useCallback((currentChapId?: string) => {
		if (typeof window === 'undefined') return;
		try {
			const currentKey = currentChapId ? `stories_tts_pos_${currentChapId}` : null;
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				const isStale = key?.startsWith('stories_tts_pos_') && key !== currentKey;
				if (isStale && key) {
					localStorage.removeItem(key);
				}
			}
		} catch (err) {
			console.debug('[ReadAloud] Clear stale positions error ignored:', err);
		}
	}, []);

	useEffect(() => {
		clearAllStaleResumePositions(chapterId);
	}, [chapterId, clearAllStaleResumePositions]);

	return { getResumePosition, saveResumePosition, clearResumePosition };
}
