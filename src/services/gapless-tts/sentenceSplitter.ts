import { INVISIBLE_SENTENCE_DELIMITER } from '@/shared/constants/textBoundaries';

export { INVISIBLE_SENTENCE_DELIMITER } from '@/shared/constants/textBoundaries';

export interface SentenceChunk {
	pIdx: number;
	text: string;
	startOffset: number;
	length: number;
	/** True when the chunk was split only to satisfy the TTS request limit. */
	artificialSplit?: boolean;
	/** True when the API explicitly ended a grouped source line here. */
	explicitBoundary?: boolean;
}

export interface SpeechSegment extends SentenceChunk {
	sentenceStartIndex: number;
	sentenceEndIndex: number;
}

export interface SpeechSegmentOptions {
	targetCharacters?: number;
	maxCharacters?: number;
}

export interface SentenceSplitOptions {
	maxCharacters?: number;
}

export interface WordCue {
	text: string;
	charIndex: number;
	charLength: number;
	startSeconds: number;
	endSeconds: number;
}

const MAX_PHRASE_CHARACTERS = 180;
const DEFAULT_TARGET_CHARACTERS = 160;
const DEFAULT_MAX_CHARACTERS = MAX_PHRASE_CHARACTERS;
const WORD_PATTERN = /[^\s.,!?:;'"(){}[\]“”‘’\-–—]+/gu;

interface BoundaryPauseProfile {
	softBreak: number;
	clause: number;
	sentence: number;
	expressiveSentence: number;
	ellipsis: number;
	paragraph: number;
}

const NATURAL_FAST_PAUSE_PROFILE: Readonly<BoundaryPauseProfile> = {
	softBreak: 0.04,
	clause: 0.12,
	sentence: 0.26,
	expressiveSentence: 0.34,
	ellipsis: 0.46,
	paragraph: 0.56,
};
const ELLIPSIS_ENDING_PATTERN = /(?:\.{3}|…)["'”’)\]]*$/u;
const EXPRESSIVE_ENDING_PATTERN = /[!?]+["'”’)\]]*$/u;
const SENTENCE_ENDING_PATTERN = /\.["'”’)\]]*$/u;
const CLAUSE_ENDING_PATTERN = /[,;:]["'”’)\]]*$/u;

export function getBoundaryPauseSeconds(previous: SpeechSegment, next: SpeechSegment): number {
	if (previous.pIdx !== next.pIdx) return NATURAL_FAST_PAUSE_PROFILE.paragraph;

	/*
	 * A delimiter is a source boundary; an artificial max-length split is not.
	 * This prevents a long sentence ending near a comma from sounding like it
	 * was intentionally cut at a clause.
	 */
	if (previous.explicitBoundary) return NATURAL_FAST_PAUSE_PROFILE.sentence;
	if (previous.artificialSplit) return NATURAL_FAST_PAUSE_PROFILE.softBreak;

	const ending = previous.text.trimEnd();
	if (ELLIPSIS_ENDING_PATTERN.test(ending)) {
		return NATURAL_FAST_PAUSE_PROFILE.ellipsis;
	}
	if (EXPRESSIVE_ENDING_PATTERN.test(ending)) {
		return NATURAL_FAST_PAUSE_PROFILE.expressiveSentence;
	}
	if (SENTENCE_ENDING_PATTERN.test(ending)) {
		return NATURAL_FAST_PAUSE_PROFILE.sentence;
	}
	if (CLAUSE_ENDING_PATTERN.test(ending)) {
		return NATURAL_FAST_PAUSE_PROFILE.clause;
	}
	return NATURAL_FAST_PAUSE_PROFILE.softBreak;
}

function joinChunksPreservingOffsets(previous: SentenceChunk, next: SentenceChunk): string {
	const previousEndOffset = previous.startOffset + previous.length;
	const gapLength = Math.max(0, next.startOffset - previousEndOffset);

	return `${previous.text}${' '.repeat(gapLength)}${next.text}`;
}

function splitLongSpeechChunk(chunk: SentenceChunk, maxCharacters: number): SentenceChunk[] {
	if (chunk.length <= maxCharacters) return [chunk];

	const phrases: SentenceChunk[] = [];
	let cursor = 0;

	while (chunk.text.length - cursor > maxCharacters) {
		const candidateEnd = Math.min(chunk.text.length, cursor + maxCharacters);
		const candidate = chunk.text.slice(cursor, candidateEnd);
		/*
		 * Never split a word/token. Prefer the last whitespace inside the window;
		 * if one token exceeds the window, extend to its next boundary.
		 */
		const whitespace = [...candidate.matchAll(/\s/gu)].at(-1);
		let breakAt = whitespace ? cursor + whitespace.index! : -1;
		if (breakAt <= cursor) {
			const nextWhitespace = chunk.text.slice(candidateEnd).search(/\s/u);
			breakAt = nextWhitespace >= 0 ? candidateEnd + nextWhitespace : chunk.text.length;
		}

		const rawPhrase = chunk.text.slice(cursor, cursor + breakAt);
		const leadingWhitespace = rawPhrase.length - rawPhrase.trimStart().length;
		const phraseText = rawPhrase.trim();
		if (phraseText) {
			phrases.push({
				pIdx: chunk.pIdx,
				text: phraseText,
				startOffset: chunk.startOffset + cursor + leadingWhitespace,
				length: phraseText.length,
				artificialSplit: true,
			});
		}
		cursor += breakAt;
	}

	const rawRemainder = chunk.text.slice(cursor);
	const leadingWhitespace = rawRemainder.length - rawRemainder.trimStart().length;
	const remainderText = rawRemainder.trim();
	if (remainderText) {
		phrases.push({
			pIdx: chunk.pIdx,
			text: remainderText,
			startOffset: chunk.startOffset + cursor + leadingWhitespace,
			length: remainderText.length,
			artificialSplit: true,
		});
	}

	return phrases;
}

export function splitParagraphIntoSentences(text: string, pIdx: number, options: SentenceSplitOptions = {}): SentenceChunk[] {
	if (!text || !text.trim()) return [];

	/*
	 * The chapter API uses an invisible separator when it groups source lines.
	 * Split at that hard boundary before punctuation heuristics and preserve
	 * offsets so word highlighting still maps to the rendered text.
	 */
	if (text.includes(INVISIBLE_SENTENCE_DELIMITER)) {
		const markedParts = text.split(INVISIBLE_SENTENCE_DELIMITER);
		const chunks: SentenceChunk[] = [];
		let partOffset = 0;
		markedParts.forEach((part, partIndex) => {
			const partChunks = splitParagraphIntoSentences(part, pIdx, options).map((chunk) => ({
				...chunk,
				startOffset: chunk.startOffset + partOffset,
			}));
			if (partIndex < markedParts.length - 1 && partChunks.length > 0) {
				const lastChunk = partChunks[partChunks.length - 1];
				partChunks[partChunks.length - 1] = { ...lastChunk, explicitBoundary: true };
			}
			chunks.push(...partChunks);
			partOffset += part.length + INVISIBLE_SENTENCE_DELIMITER.length;
		});
		return chunks;
	}

	const maxCharacters = Math.max(1, options.maxCharacters ?? MAX_PHRASE_CHARACTERS);

	const sentenceRegex = /[^.!?…\n]+[.!?…\n]*/g;
	const sentences: SentenceChunk[] = [];
	let match: RegExpExecArray | null;

	while ((match = sentenceRegex.exec(text)) !== null) {
		const rawSentence = match[0];
		const trimmedSentence = rawSentence.trim();
		if (!trimmedSentence) continue;

		const leadingSpaces = rawSentence.length - rawSentence.trimStart().length;
		const sentence = {
			pIdx,
			text: trimmedSentence,
			startOffset: match.index + leadingSpaces,
			length: trimmedSentence.length,
		};
		sentences.push(...splitLongSpeechChunk(sentence, maxCharacters));
	}

	if (sentences.length === 0 && text.trim()) {
		const trimmedText = text.trim();
		sentences.push({
			pIdx,
			text: trimmedText,
			startOffset: text.length - text.trimStart().length,
			length: trimmedText.length,
		});
	}

	const mergedSentences: SentenceChunk[] = [];
	sentences.forEach((sentence) => {
		const previous = mergedSentences.at(-1);
		if (previous && previous.pIdx === sentence.pIdx && sentence.text.length < 10) {
			const combinedText = joinChunksPreservingOffsets(previous, sentence);
			if (combinedText.length <= maxCharacters) {
				previous.text = combinedText;
				previous.length = previous.text.length;
				return;
			}
		}
		mergedSentences.push({ ...sentence });
	});

	return mergedSentences;
}

/** Split only at the explicit DB delimiter; each part remains an atomic source unit. */
export function splitByDatabaseBoundaries(text: string, pIdx: number): SentenceChunk[] {
	if (!text || !text.trim()) return [];

	const parts = text.split(INVISIBLE_SENTENCE_DELIMITER);
	const chunks: SentenceChunk[] = [];
	let offset = 0;
	parts.forEach((part, index) => {
		const leadingSpaces = part.length - part.trimStart().length;
		const trimmed = part.trim();
		if (trimmed) {
			chunks.push({
				pIdx,
				text: trimmed,
				startOffset: offset + leadingSpaces,
				length: trimmed.length,
				explicitBoundary: index < parts.length - 1,
			});
		}
		offset += part.length + INVISIBLE_SENTENCE_DELIMITER.length;
	});
	return chunks;
}

export function buildSpeechSegments(sentences: SentenceChunk[], options: SpeechSegmentOptions = {}): SpeechSegment[] {
	const maxCharacters = Math.max(1, options.maxCharacters ?? DEFAULT_MAX_CHARACTERS);
	const targetCharacters = Math.min(Math.max(1, options.targetCharacters ?? DEFAULT_TARGET_CHARACTERS), maxCharacters);
	const segments: SpeechSegment[] = [];

	sentences.forEach((sentence, sentenceIndex) => {
		const previous = segments.at(-1);
		const combinedText = previous && previous.pIdx === sentence.pIdx ? joinChunksPreservingOffsets(previous, sentence) : sentence.text;
		const mustStartNewSegment =
			!previous || previous.pIdx !== sentence.pIdx || previous.text.length >= targetCharacters || combinedText.length > maxCharacters;

		if (mustStartNewSegment) {
			segments.push({
				...sentence,
				sentenceStartIndex: sentenceIndex,
				sentenceEndIndex: sentenceIndex,
			});
			return;
		}

		previous.text = combinedText;
		previous.length = combinedText.length;
		previous.sentenceEndIndex = sentenceIndex;
	});

	return segments;
}

export function buildWordTimeline(text: string, audioDurationSeconds: number): WordCue[] {
	if (!text.trim() || audioDurationSeconds <= 0) return [];

	const matches = Array.from(text.matchAll(WORD_PATTERN));
	if (matches.length === 0) return [];

	const weightedWords = matches.map((match, index) => {
		const charIndex = match.index ?? 0;
		const word = match[0];
		const nextCharIndex = matches[index + 1]?.index ?? text.length;
		const trailingText = text.slice(charIndex + word.length, nextCharIndex);
		const wordWeight = 1 + Math.min(word.length, 12) * 0.02;
		let pauseWeight = 0;
		if (/[.!?…]/u.test(trailingText)) {
			pauseWeight = 0.9;
		} else if (/[,;:]/u.test(trailingText)) {
			pauseWeight = 0.35;
		}

		return {
			text: word,
			charIndex,
			charLength: word.length,
			wordWeight,
			totalWeight: wordWeight + pauseWeight,
		};
	});
	const totalWeight = weightedWords.reduce((total, word) => total + word.totalWeight, 0);
	const edgePadding = Math.min(0.08, audioDurationSeconds * 0.03);
	const spokenDuration = Math.max(0, audioDurationSeconds - edgePadding * 2);
	let elapsedWeight = 0;

	return weightedWords.map((word) => {
		const startSeconds = edgePadding + (elapsedWeight / totalWeight) * spokenDuration;
		const endSeconds = startSeconds + (word.wordWeight / totalWeight) * spokenDuration;
		elapsedWeight += word.totalWeight;
		return {
			text: word.text,
			charIndex: word.charIndex,
			charLength: word.charLength,
			startSeconds,
			endSeconds,
		};
	});
}
