import type { SentenceChunk } from '@/services/gaplessTtsPlayer';
import type { ReadAloudResumePosition } from './useReadAloudResume';

export function resolveReadAloudStart(chunks: SentenceChunk[], current: number, saved: ReadAloudResumePosition | null, targetIndex?: number, targetOffset = 0) {
	const fallback = { index: targetIndex ?? current, offset: targetOffset };
	if (targetIndex !== undefined || current !== 0 || !saved) return fallback;
	if (saved.version === 2 && saved.paragraphIndex !== undefined && saved.sourceOffset !== undefined) return migrateSourcePosition(chunks, saved, fallback);
	if (saved.chunkIndex < chunks.length) return { index: saved.chunkIndex, offset: saved.charOffset || 0 };
	return fallback;
}

function migrateSourcePosition(chunks: SentenceChunk[], saved: ReadAloudResumePosition, fallback: { index: number; offset: number }) {
	const sourceOffset = saved.sourceOffset ?? 0;
	const index = chunks.findIndex((chunk) => chunk.pIdx === saved.paragraphIndex && sourceOffset < chunk.startOffset + chunk.length);
	if (index < 0) return fallback;
	return { index, offset: Math.max(0, sourceOffset - chunks[index].startOffset) };
}
