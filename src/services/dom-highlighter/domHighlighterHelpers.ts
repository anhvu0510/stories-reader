export interface HighlightLike {
	priority?: number;
}

export interface HighlightRegistryLike {
	set(name: string, highlight: unknown): void;
	delete(name: string): boolean;
}

export interface HighlightConstructorLike {
	new (...ranges: Range[]): HighlightLike;
}

export interface CachedLineItem {
	rect: DOMRect;
	startOffset: number;
	endOffset: number;
}

export interface CachedLineLayout {
	lines: CachedLineItem[];
	textLength: number;
}

export const CSS_WORD_HIGHLIGHT_NAME = 'stories-tts-word';
export const CSS_LINE_HIGHLIGHT_NAME = 'stories-tts-line';
export const CSS_UTTERANCE_HIGHLIGHT_NAME = 'stories-tts-utterance';
export const LINE_Y_TOLERANCE = 4;
const HIGHLIGHT_STYLE_ID = 'stories-tts-highlight-styles';

export function ensureHighlightStyleSheet(): void {
	if (typeof document === 'undefined') return;
	if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = HIGHLIGHT_STYLE_ID;
	style.textContent = `
::highlight(stories-tts-line) {
		background-color: rgba(147, 197, 253, 0.16);
	color: inherit;
}
::highlight(stories-tts-utterance) {
		background-color: rgba(147, 197, 253, 0.16);
	color: inherit;
}
::highlight(stories-tts-word) {
		background-color: rgba(234, 179, 8, 0.32);
		color: inherit;
}
`;
	document.head.appendChild(style);
}

export function getHighlightRegistry(): HighlightRegistryLike | null {
	const css = globalThis.CSS as typeof CSS & { highlights?: HighlightRegistryLike };
	return css?.highlights ?? null;
}

export function getHighlightConstructor(): HighlightConstructorLike | null {
	return (globalThis as typeof globalThis & { Highlight?: HighlightConstructorLike }).Highlight ?? null;
}

export function createTextRange(rootElement: HTMLElement, startOffset: number, length: number): Range | null {
	const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
	const endOffset = startOffset + length;
	let currentOffset = 0;
	let startNode: Text | null = null;
	let endNode: Text | null = null;
	let rangeStart = 0;
	let rangeEnd = 0;
	let node: Node | null;

	while ((node = walker.nextNode())) {
		const textNode = node as Text;
		const nodeEnd = currentOffset + textNode.data.length;
		if (!startNode && nodeEnd > startOffset) {
			startNode = textNode;
			rangeStart = Math.max(0, startOffset - currentOffset);
		}
		if (startNode && nodeEnd >= endOffset) {
			endNode = textNode;
			rangeEnd = Math.max(0, Math.min(textNode.data.length, endOffset - currentOffset));
			break;
		}
		currentOffset = nodeEnd;
	}

	if (!startNode) return null;
	if (!endNode) {
		endNode = startNode;
		rangeEnd = Math.min(startNode.data.length, rangeStart + length);
	}

	const range = document.createRange();
	range.setStart(startNode, rangeStart);
	range.setEnd(endNode, rangeEnd);
	return range;
}

export function unionRects(rects: DOMRect[]): DOMRect {
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	rects.forEach((rect) => {
		left = Math.min(left, rect.left);
		top = Math.min(top, rect.top);
		right = Math.max(right, rect.right);
		bottom = Math.max(bottom, rect.bottom);
	});
	return new DOMRect(left, top, right - left, bottom - top);
}

export function mergeLineFragments(rects: DOMRect[]): DOMRect[] {
	const lines: DOMRect[] = [];
	rects.forEach((rect) => {
		const index = lines.findIndex((line) => Math.abs(line.top - rect.top) <= LINE_Y_TOLERANCE);
		if (index === -1) {
			lines.push(rect);
			return;
		}

		const line = lines[index];
		const left = Math.min(line.left, rect.left);
		const top = Math.min(line.top, rect.top);
		const right = Math.max(line.right, rect.right);
		const bottom = Math.max(line.bottom, rect.bottom);
		lines[index] = new DOMRect(left, top, right - left, bottom - top);
	});
	return lines;
}

export function computeMergedRects(rootElement: HTMLElement, scrollX: number, scrollY: number): DOMRect[] {
	const contentRange = document.createRange();
	contentRange.selectNodeContents(rootElement);
	const documentRects = Array.from(contentRange.getClientRects())
		.filter((rect) => rect.width > 0 && rect.height > 0)
		.map((rect) => new DOMRect(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height));

	const mergedRects = mergeLineFragments(documentRects);
	mergedRects.sort((a, b) => a.top - b.top);
	return mergedRects;
}

function getNextCharTop(rootElement: HTMLElement, offset: number, maxOffset: number): number | null {
	if (offset + 1 >= maxOffset) return null;
	const nextRange = createTextRange(rootElement, offset + 1, 1);
	const nextRects = nextRange?.getClientRects();
	if (nextRects && nextRects.length > 0 && nextRects[0].width > 0) {
		return nextRects[0].top;
	}
	return null;
}

function getCharEffectiveY(rootElement: HTMLElement, offset: number, maxOffset: number, scrollY: number): number | null {
	const range = createTextRange(rootElement, offset, 1);
	if (!range) return null;

	const rects = range.getClientRects();
	const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
	if (rect && rect.height > 0 && rect.width > 0) {
		return rect.top + scrollY;
	}

	const nextTop = getNextCharTop(rootElement, offset, maxOffset);
	if (nextTop !== null) {
		return nextTop + scrollY;
	}

	return (rect && rect.height > 0 ? rect.top : 0) + scrollY;
}

function findBoundaryOffset(
	rootElement: HTMLElement,
	_currentLine: DOMRect,
	nextLine: DOMRect,
	minOffset: number,
	maxOffset: number,
	scrollY: number
): number {
	let low = minOffset;
	let high = maxOffset;
	let boundary = maxOffset;
	const targetY = nextLine.top - LINE_Y_TOLERANCE;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		if (mid >= maxOffset) break;

		const effectiveY = getCharEffectiveY(rootElement, mid, maxOffset, scrollY);
		if (effectiveY === null) break;

		if (effectiveY >= targetY) {
			boundary = mid;
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}

	if (boundary <= minOffset || boundary > maxOffset) {
		return Math.min(maxOffset, Math.max(minOffset, Math.round((minOffset + maxOffset) / 2)));
	}
	return boundary;
}

export function buildLineItems(rootElement: HTMLElement, mergedRects: DOMRect[], textLength: number, scrollY: number): CachedLineItem[] {
	if (mergedRects.length <= 1) {
		const rect = mergedRects[0] ?? new DOMRect(0, 0, 0, 0);
		return [{ rect, startOffset: 0, endOffset: textLength }];
	}
	const lineItems: CachedLineItem[] = [];
	let prevBoundary = 0;
	for (let i = 0; i < mergedRects.length - 1; i++) {
		const boundary = findBoundaryOffset(rootElement, mergedRects[i], mergedRects[i + 1], prevBoundary, textLength, scrollY);
		lineItems.push({ rect: mergedRects[i], startOffset: prevBoundary, endOffset: boundary });
		prevBoundary = boundary;
	}
	lineItems.push({ rect: mergedRects[mergedRects.length - 1], startOffset: prevBoundary, endOffset: textLength });
	return lineItems;
}
