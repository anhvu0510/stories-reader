interface HighlightLike {
	priority?: number;
}

interface HighlightRegistryLike {
	set(name: string, highlight: unknown): void;
	delete(name: string): boolean;
}

interface HighlightConstructorLike {
	new (...ranges: Range[]): HighlightLike;
}

interface CachedLineItem {
	rect: DOMRect;
	startOffset: number;
	endOffset: number;
}

interface CachedLineLayout {
	lines: CachedLineItem[];
	textLength: number;
}

export interface ReadAloudHighlightGeometry {
	line: DOMRect;
	word: DOMRect;
	utteranceChanged?: boolean;
	lineChanged?: boolean;
}

const CSS_WORD_HIGHLIGHT_NAME = 'stories-tts-word';
const CSS_LINE_HIGHLIGHT_NAME = 'stories-tts-line';
const CSS_UTTERANCE_HIGHLIGHT_NAME = 'stories-tts-utterance';
const LINE_Y_TOLERANCE = 4;
const HIGHLIGHT_STYLE_ID = 'stories-tts-highlight-styles';

function ensureHighlightStyleSheet(): void {
	if (typeof document === 'undefined') return;
	if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = HIGHLIGHT_STYLE_ID;
	style.textContent = `
::highlight(stories-tts-line) {
	background-color: rgba(147, 197, 253, 0.28);
	color: inherit;
}
::highlight(stories-tts-utterance) {
	background-color: rgba(147, 197, 253, 0.28);
	color: inherit;
}
::highlight(stories-tts-word) {
	background-color: #fde047;
	color: #000000;
}
`;
	document.head.appendChild(style);
}

export class DomWordHighlighter {
	private readonly className: string;
	private marks: HTMLElement[] = [];
	private lineHighlight: HTMLElement | null = null;
	private readonly lineLayoutCache = new WeakMap<HTMLElement, CachedLineLayout>();
	private observedRoot: HTMLElement | null = null;
	private readonly resizeObserver?: ResizeObserver;
	private currentLineRange: Range | null = null;
	private currentLineRect: DOMRect | null = null;
	private currentUtteranceKey: string | null = null;
	private currentUtteranceRoot: HTMLElement | null = null;
	private currentUtteranceRect: DOMRect | null = null;

	constructor(className: string) {
		this.className = className;
		ensureHighlightStyleSheet();
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver((entries) => {
				entries.forEach((entry) => this.lineLayoutCache.delete(entry.target as HTMLElement));
			});
		}
	}

	public highlight(rootElement: HTMLElement, startOffset: number, length: number): ReadAloudHighlightGeometry | null {
		if (length <= 0) {
			this.clear();
			return null;
		}

		this.clearFallbackMarks();

		const wordRange = this.createTextRange(rootElement, startOffset, length);
		if (!wordRange) {
			this.clear();
			return null;
		}

		const registry = this.getHighlightRegistry();
		const HighlightConstructor = this.getHighlightConstructor();
		let wordRects: DOMRect[];

		if (registry && HighlightConstructor) {
			const wordHighlight = new HighlightConstructor(wordRange);
			wordHighlight.priority = 2;
			registry.set(CSS_WORD_HIGHLIGHT_NAME, wordHighlight);
			wordRects = Array.from(wordRange.getClientRects());
		} else {
			this.wrapRangeForFallback(wordRange);
			wordRects = this.marks.map((mark) => mark.getBoundingClientRect());
		}

		const visibleWordRects = wordRects.filter((rect) => rect.width > 0 && rect.height > 0);
		if (visibleWordRects.length === 0) {
			this.removeLineHighlight();
			return null;
		}

		const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
		const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
		const viewportWordRect = this.unionRects(visibleWordRects);
		const documentWordRect = new DOMRect(viewportWordRect.left + scrollX, viewportWordRect.top + scrollY, viewportWordRect.width, viewportWordRect.height);
		const { lineRect: documentLineRect, lineRange } = this.findLineLayout(rootElement, documentWordRect, scrollX, scrollY);

		const isSameLine =
			this.currentLineRange &&
			lineRange &&
			this.currentLineRange.startContainer === lineRange.startContainer &&
			this.currentLineRange.startOffset === lineRange.startOffset &&
			this.currentLineRange.endContainer === lineRange.endContainer &&
			this.currentLineRange.endOffset === lineRange.endOffset;

		if (!isSameLine) {
			this.currentLineRange = lineRange;
			this.currentLineRect = documentLineRect;

			if (registry && HighlightConstructor && lineRange) {
				const lineHighlight = new HighlightConstructor(lineRange);
				lineHighlight.priority = 1;
				registry.set(CSS_LINE_HIGHLIGHT_NAME, lineHighlight);
				this.removeLineHighlight();
			} else {
				this.updateLineHighlight(documentLineRect);
			}
		}

		return { line: documentLineRect, word: documentWordRect, lineChanged: !isSameLine };
	}

	public highlightUtteranceAndWord(
		rootElement: HTMLElement,
		utteranceStart: number,
		utteranceLength: number,
		wordStart: number,
		wordLength: number
	): ReadAloudHighlightGeometry | null {
		if (utteranceLength <= 0 || wordLength <= 0) return null;

		const registry = this.getHighlightRegistry();
		const HighlightConstructor = this.getHighlightConstructor();
		if (!registry || !HighlightConstructor) {
			return this.highlightFallbackUtterance(rootElement, utteranceStart, utteranceLength, wordStart, wordLength);
		}

		const wordRange = this.createTextRange(rootElement, wordStart, wordLength);
		if (!wordRange) return null;

		const utteranceKey = `${utteranceStart}:${utteranceLength}`;
		const utteranceChanged = this.currentUtteranceRoot !== rootElement || this.currentUtteranceKey !== utteranceKey;
		if (utteranceChanged) this.setUtteranceHighlight(rootElement, utteranceStart, utteranceLength, registry, HighlightConstructor);

		const wordHighlight = new HighlightConstructor(wordRange);
		wordHighlight.priority = 2;
		registry.set(CSS_WORD_HIGHLIGHT_NAME, wordHighlight);

		const wordRect = this.getDocumentRect(wordRange);
		if (!wordRect || !this.currentUtteranceRect) return null;
		return { line: this.currentUtteranceRect, word: wordRect, utteranceChanged };
	}

	private highlightFallbackUtterance(root: HTMLElement, start: number, length: number, wordStart: number, wordLength: number): ReadAloudHighlightGeometry | null {
		const key = `${start}:${length}`;
		const utteranceChanged = this.currentUtteranceRoot !== root || this.currentUtteranceKey !== key;
		const geometry = this.highlight(root, wordStart, wordLength);
		this.currentUtteranceRoot = root;
		this.currentUtteranceKey = key;
		if (!geometry) return null;
		return { ...geometry, utteranceChanged };
	}

	private setUtteranceHighlight(
		rootElement: HTMLElement,
		start: number,
		length: number,
		registry: HighlightRegistryLike,
		HighlightConstructor: HighlightConstructorLike
	): void {
		const range = this.createTextRange(rootElement, start, length);
		if (!range) return;
		const highlight = new HighlightConstructor(range);
		highlight.priority = 1;
		registry.set(CSS_UTTERANCE_HIGHLIGHT_NAME, highlight);
		this.currentUtteranceKey = `${start}:${length}`;
		this.currentUtteranceRoot = rootElement;
		this.currentUtteranceRect = this.getDocumentRect(range);
	}

	private getDocumentRect(range: Range): DOMRect | null {
		const rects = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
		const visibleRects = rects.filter((rect) => rect.width > 0 && rect.height > 0);
		if (visibleRects.length === 0) return null;
		const rect = this.unionRects(visibleRects);
		const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
		const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
		return new DOMRect(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height);
	}

	public clear(): void {
		this.clearWordHighlight();
		this.removeLineHighlight();
	}

	public dispose(): void {
		this.clear();
		if (this.resizeObserver && this.observedRoot) {
			this.resizeObserver.unobserve(this.observedRoot);
		}
		this.resizeObserver?.disconnect();
		this.observedRoot = null;
	}

	private getHighlightRegistry(): HighlightRegistryLike | null {
		const css = globalThis.CSS as typeof CSS & { highlights?: HighlightRegistryLike };
		return css?.highlights ?? null;
	}

	private getHighlightConstructor(): HighlightConstructorLike | null {
		return (globalThis as typeof globalThis & { Highlight?: HighlightConstructorLike }).Highlight ?? null;
	}

	private createTextRange(rootElement: HTMLElement, startOffset: number, length: number): Range | null {
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

	private wrapRangeForFallback(range: Range): void {
		const mark = document.createElement('span');
		mark.className = this.className;
		mark.appendChild(range.extractContents());
		range.insertNode(mark);
		this.marks.push(mark);
	}

	private clearFallbackMarks(): void {
		const parents = new Set<Node>();
		this.marks.forEach((mark) => {
			const parent = mark.parentNode;
			if (!parent) return;
			parents.add(parent);
			mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
		});
		parents.forEach((parent) => parent.normalize());
		this.marks = [];
	}

	private clearWordHighlight(): void {
		const registry = this.getHighlightRegistry();
		registry?.delete(CSS_WORD_HIGHLIGHT_NAME);
		registry?.delete(CSS_LINE_HIGHLIGHT_NAME);
		registry?.delete(CSS_UTTERANCE_HIGHLIGHT_NAME);
		this.clearFallbackMarks();
		this.currentLineRange = null;
		this.currentLineRect = null;
		this.currentUtteranceKey = null;
		this.currentUtteranceRoot = null;
		this.currentUtteranceRect = null;
	}

	private getLineLayout(rootElement: HTMLElement, scrollX: number, scrollY: number): CachedLineLayout {
		const textLength = rootElement.textContent?.length ?? 0;
		let cachedLayout = this.lineLayoutCache.get(rootElement);
		if (!cachedLayout || cachedLayout.textLength !== textLength) {
			const contentRange = document.createRange();
			contentRange.selectNodeContents(rootElement);
			const documentRects = Array.from(contentRange.getClientRects())
				.filter((rect) => rect.width > 0 && rect.height > 0)
				.map((rect) => new DOMRect(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height));

			const mergedRects = this.mergeLineFragments(documentRects);
			mergedRects.sort((a, b) => a.top - b.top);

			const lineItems: CachedLineItem[] = [];
			if (mergedRects.length <= 1) {
				const rect = mergedRects[0] ?? new DOMRect(0, 0, 0, 0);
				lineItems.push({ rect, startOffset: 0, endOffset: textLength });
			} else {
				let prevBoundary = 0;
				for (let i = 0; i < mergedRects.length - 1; i++) {
					const boundary = this.findBoundaryOffset(rootElement, mergedRects[i], mergedRects[i + 1], prevBoundary, textLength, scrollY);
					lineItems.push({ rect: mergedRects[i], startOffset: prevBoundary, endOffset: boundary });
					prevBoundary = boundary;
				}
				lineItems.push({ rect: mergedRects[mergedRects.length - 1], startOffset: prevBoundary, endOffset: textLength });
			}

			cachedLayout = {
				lines: lineItems,
				textLength
			};
			this.lineLayoutCache.set(rootElement, cachedLayout);
			if (this.resizeObserver && this.observedRoot !== rootElement) {
				if (this.observedRoot) this.resizeObserver.unobserve(this.observedRoot);
				this.resizeObserver.observe(rootElement);
				this.observedRoot = rootElement;
			}
		}

		return cachedLayout;
	}

	private findBoundaryOffset(
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

			const range = this.createTextRange(rootElement, mid, 1);
			if (!range) break;

			const rects = range.getClientRects();
			const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();

			let effectiveY = (rect && rect.height > 0 ? rect.top : 0) + scrollY;
			if ((!rect || rect.width === 0 || rect.height === 0) && mid + 1 < maxOffset) {
				const nextRange = this.createTextRange(rootElement, mid + 1, 1);
				const nextRects = nextRange?.getClientRects();
				if (nextRects && nextRects.length > 0 && nextRects[0].width > 0) {
					effectiveY = nextRects[0].top + scrollY;
				}
			}

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

	private findLineLayout(
		rootElement: HTMLElement,
		wordRect: DOMRect,
		scrollX: number,
		scrollY: number
	): { lineRect: DOMRect; lineRange: Range | null } {
		const cachedLayout = this.getLineLayout(rootElement, scrollX, scrollY);
		const wordMiddleY = wordRect.top + wordRect.height / 2;
		let lineItem = cachedLayout.lines.find((line) => wordMiddleY >= line.rect.top - LINE_Y_TOLERANCE && wordMiddleY <= line.rect.bottom + LINE_Y_TOLERANCE);

		if (!lineItem && cachedLayout.lines.length > 0) {
			lineItem = cachedLayout.lines.reduce((closest, line) => {
				const distLine = Math.abs(wordMiddleY - (line.rect.top + line.rect.height / 2));
				const distClosest = Math.abs(wordMiddleY - (closest.rect.top + closest.rect.height / 2));
				return distLine < distClosest ? line : closest;
			});
		}

		if (!lineItem) {
			return { lineRect: wordRect, lineRange: null };
		}

		const lineRange = this.createTextRange(rootElement, lineItem.startOffset, Math.max(1, lineItem.endOffset - lineItem.startOffset));
		return { lineRect: lineItem.rect, lineRange };
	}

	private mergeLineFragments(rects: DOMRect[]): DOMRect[] {
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

	private updateLineHighlight(lineRect: DOMRect): void {
		if (!this.lineHighlight) {
			this.lineHighlight = document.createElement('span');
			this.lineHighlight.className = 'stories-tts-line-wash';
			this.lineHighlight.setAttribute('aria-hidden', 'true');
			document.body.appendChild(this.lineHighlight);
		}

		this.lineHighlight.style.transform = `translate3d(${lineRect.left}px, ${lineRect.top}px, 0)`;
		this.lineHighlight.style.width = `${lineRect.width}px`;
		this.lineHighlight.style.height = `${lineRect.height}px`;
	}

	private unionRects(rects: DOMRect[]): DOMRect {
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

	private removeLineHighlight(): void {
		this.lineHighlight?.remove();
		this.lineHighlight = null;
	}
}
