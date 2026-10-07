import { useMemo } from 'react';
import { splitByDatabaseBoundaries, type SentenceChunk } from '@/services/gaplessTtsPlayer';
import { buildReadAloudUtterancePlanFromChunks } from '@/services/readAloudUtterancePlan';
import type { ReadAloudChapterContext } from '../useReadAloud';

export function useReadAloudPlan(paragraphs: string[], chapterContext: ReadAloudChapterContext, paragraphContexts: ReadAloudChapterContext[]) {
	const chunks = useMemo(() => {
		const res: SentenceChunk[] = [];
		paragraphs.forEach((html, pIdx) => {
			if (!html) return;
			const tmp = document.createElement('div');
			tmp.innerHTML = html;
			const text = tmp.textContent || tmp.innerText || '';

			if (text.trim()) {
				// Paragraphs are already sentence units from getChapterContent. The
				// only valid subdivision is the invisible DB grouping delimiter.
				const sentenceChunks = splitByDatabaseBoundaries(text, pIdx);
				res.push(...sentenceChunks);
			}
		});
		return res.map((sentence, sentenceIndex) => ({
			...sentence,
			sentenceStartIndex: sentenceIndex,
			sentenceEndIndex: sentenceIndex
		}));
	}, [paragraphs]);
	const media3Utterances = useMemo(() => buildReadAloudUtterancePlanFromChunks(chunks), [chunks]);
	const getMedia3UtteranceIndex = (chunkIndex: number, sourceOffset?: number): number => {
		const utteranceIndex = media3Utterances.findIndex(
			(utterance) => utterance.sourceChunkIndex === chunkIndex && (sourceOffset === undefined || sourceOffset < utterance.sourceStart + utterance.sourceLength)
		);
		return utteranceIndex >= 0 ? utteranceIndex : 0;
	};

	const segmentMetadata = useMemo(() => {
		const totals = new Map<string, number>();
		const indexes = new Map<string, number>();
		const contextForChunk = (chunk: SentenceChunk) => paragraphContexts[chunk.pIdx] || chapterContext;
		for (const chunk of chunks) {
			const context = contextForChunk(chunk);
			const key = `${context.bookId || ''}:${context.chapterId || ''}:${context.chapterNumber || 0}`;
			totals.set(key, (totals.get(key) || 0) + 1);
		}
		return chunks.map((chunk) => {
			const context = contextForChunk(chunk);
			const key = `${context.bookId || ''}:${context.chapterId || ''}:${context.chapterNumber || 0}`;
			const segmentIndex = indexes.get(key) || 0;
			indexes.set(key, segmentIndex + 1);
			return {
				context,
				segmentIndex,
				segmentCount: totals.get(key) || chunks.length
			};
		});
	}, [chapterContext, chunks, paragraphContexts]);

	return { chunks, media3Utterances, getMedia3UtteranceIndex, segmentMetadata };
}
