import { buildSpeechSegments, splitParagraphIntoSentences, type SentenceChunk } from '@/services/gaplessTtsPlayer';

export interface ReadAloudUtterance {
	id: string;
	paragraphIndex: number;
	sourceStart: number;
	sourceLength: number;
	text: string;
	sourceChunkIndex?: number;
}

export function buildReadAloudUtterancePlanFromChunks(chunks: SentenceChunk[]): ReadAloudUtterance[] {
	return chunks.flatMap((chunk, sourceChunkIndex) => {
		const sentences = splitParagraphIntoSentences(chunk.text, chunk.pIdx, {
			maxCharacters: MAX_UTTERANCE_CHARACTERS
		}).map((sentence) => ({
			...sentence,
			startOffset: chunk.startOffset + sentence.startOffset
		}));
		const segments = buildSpeechSegments(sentences, {
			targetCharacters: TARGET_UTTERANCE_CHARACTERS,
			maxCharacters: MAX_UTTERANCE_CHARACTERS
		});

		return segments.map((segment, utteranceIndex) => ({
			id: `c${sourceChunkIndex}-u${utteranceIndex}`,
			paragraphIndex: segment.pIdx,
			sourceStart: segment.startOffset,
			sourceLength: segment.length,
			text: segment.text,
			sourceChunkIndex
		}));
	});
}

const TARGET_UTTERANCE_CHARACTERS = 160;
const MAX_UTTERANCE_CHARACTERS = 220;

export function buildReadAloudUtterancePlan(paragraphs: string[]): ReadAloudUtterance[] {
	return paragraphs.flatMap((paragraph, paragraphIndex) => {
		const sentences = splitParagraphIntoSentences(paragraph, paragraphIndex, {
			maxCharacters: MAX_UTTERANCE_CHARACTERS
		});
		const segments = buildSpeechSegments(sentences, {
			targetCharacters: TARGET_UTTERANCE_CHARACTERS,
			maxCharacters: MAX_UTTERANCE_CHARACTERS
		});

		return segments.map((segment, utteranceIndex) => ({
			id: `p${paragraphIndex}-u${utteranceIndex}`,
			paragraphIndex,
			sourceStart: segment.startOffset,
			sourceLength: segment.length,
			text: segment.text
		}));
	});
}
