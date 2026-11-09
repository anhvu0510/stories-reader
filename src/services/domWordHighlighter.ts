import {
	buildLineItems,
	computeMergedRects,
	createTextRange,
	CSS_LINE_HIGHLIGHT_NAME,
	CSS_UTTERANCE_HIGHLIGHT_NAME,
	CSS_WORD_HIGHLIGHT_NAME,
	ensureHighlightStyleSheet,
	getHighlightConstructor,
	getHighlightRegistry,
	LINE_Y_TOLERANCE,
	unionRects,
	type CachedLineLayout,
	type HighlightConstructorLike,
	type HighlightRegistryLike,
} from './dom-highlighter/domHighlighterHelpers';

export interface ReadAloudHighlightGeometry {
	line: DOMRect;
	word: DOMRect;
	utteranceChanged?: boolean;
	lineChanged?: boolean;
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

	private applyWordHighlight(wordRange: Range): DOMRect[] {
		const registry = getHighlightRegistry();
		const HighlightConstructor = getHighlightConstructor();
		if (registry && HighlightConstructor) {
			const wordHighlight = new HighlightConstructor(wordRange);
			wordHighlight.priority = 2;
			registry.set(CSS_WORD_HIGHLIGHT_NAME, wordHighlight);
			return Array.from(wordRange.getClientRects());
		}
		this.wrapRangeForFallback(wordRange);
		return this.marks.map((mark) => mark.getBoundingClientRect());
	}

	private isSameAsCurrentLine(lineRange: Range | null): boolean {
		if (!this.currentLineRange || !lineRange) return false;
		return (
			this.currentLineRange.startContainer === lineRange.startContainer &&
			this.currentLineRange.startOffset === lineRange.startOffset &&
			this.currentLineRange.endContainer === lineRange.endContainer &&
			this.currentLineRange.endOffset === lineRange.endOffset
		);
	}

	private applyLineHighlight(lineRange: Range | null, documentLineRect: DOMRect): void {
		const registry = getHighlightRegistry();
		const HighlightConstructor = getHighlightConstructor();
		if (registry && HighlightConstructor && lineRange) {
			const lineHighlight = new HighlightConstructor(lineRange);
			lineHighlight.priority = 1;
			registry.set(CSS_LINE_HIGHLIGHT_NAME, lineHighlight);
			this.removeLineHighlight();
			return;
		}
		this.updateLineHighlight(documentLineRect);
	}

	private getDocumentWordRect(visibleWordRects: DOMRect[]): { documentWordRect: DOMRect; scrollX: number; scrollY: number } {
		const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
		const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
		const viewportWordRect = unionRects(visibleWordRects);
		const documentWordRect = new DOMRect(
			viewportWordRect.left + scrollX,
			viewportWordRect.top + scrollY,
			viewportWordRect.width,
			viewportWordRect.height
		);
		return { documentWordRect, scrollX, scrollY };
	}

	public highlight(rootElement: HTMLElement, startOffset: number, length: number): ReadAloudHighlightGeometry | null {
		if (length <= 0) {
			this.clear();
			return null;
		}

		this.clearFallbackMarks();

		const wordRange = createTextRange(rootElement, startOffset, length);
		if (!wordRange) {
			this.clear();
			return null;
		}

		const wordRects = this.applyWordHighlight(wordRange);
		const visibleWordRects = wordRects.filter((rect) => rect.width > 0 && rect.height > 0);
		if (visibleWordRects.length === 0) {
			this.removeLineHighlight();
			return null;
		}

		const { documentWordRect, scrollX, scrollY } = this.getDocumentWordRect(visibleWordRects);
		const { lineRect: documentLineRect, lineRange } = this.findLineLayout(rootElement, documentWordRect, scrollX, scrollY);

		const isSameLine = this.isSameAsCurrentLine(lineRange);
		if (!isSameLine) {
			this.currentLineRange = lineRange;
			this.currentLineRect = documentLineRect;
			this.applyLineHighlight(lineRange, documentLineRect);
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

		const registry = getHighlightRegistry();
		const HighlightConstructor = getHighlightConstructor();
		if (!registry || !HighlightConstructor) {
			return this.highlightFallbackUtterance(rootElement, utteranceStart, utteranceLength, wordStart, wordLength);
		}

		const wordRange = createTextRange(rootElement, wordStart, wordLength);
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

	private highlightFallbackUtterance(
		root: HTMLElement,
		start: number,
		length: number,
		wordStart: number,
		wordLength: number
	): ReadAloudHighlightGeometry | null {
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
		const range = createTextRange(rootElement, start, length);
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
		const rect = unionRects(visibleRects);
		const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
		const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
		return new DOMRect(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height);
	}

	public clear(): void {
		this.clearWordHighlight();
		this.removeLineHighlight();
	}

	/** Keep the reading line in place while the next audio is buffering. */
	public clearActiveWord(): void {
		getHighlightRegistry()?.delete(CSS_WORD_HIGHLIGHT_NAME);
		this.clearFallbackMarks();
	}

	public dispose(): void {
		this.clear();
		if (this.resizeObserver && this.observedRoot) {
			this.resizeObserver.unobserve(this.observedRoot);
		}
		this.resizeObserver?.disconnect();
		this.observedRoot = null;
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
		const registry = getHighlightRegistry();
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

	private updateResizeObserver(rootElement: HTMLElement): void {
		if (!this.resizeObserver || this.observedRoot === rootElement) return;
		if (this.observedRoot) this.resizeObserver.unobserve(this.observedRoot);
		this.resizeObserver.observe(rootElement);
		this.observedRoot = rootElement;
	}

	private getLineLayout(rootElement: HTMLElement, scrollX: number, scrollY: number): CachedLineLayout {
		const textLength = rootElement.textContent?.length ?? 0;
		let cachedLayout = this.lineLayoutCache.get(rootElement);
		if (cachedLayout && cachedLayout.textLength === textLength) {
			return cachedLayout;
		}

		const mergedRects = computeMergedRects(rootElement, scrollX, scrollY);
		const lineItems = buildLineItems(rootElement, mergedRects, textLength, scrollY);

		cachedLayout = {
			lines: lineItems,
			textLength,
		};
		this.lineLayoutCache.set(rootElement, cachedLayout);
		this.updateResizeObserver(rootElement);
		return cachedLayout;
	}

	private findLineLayout(
		rootElement: HTMLElement,
		wordRect: DOMRect,
		scrollX: number,
		scrollY: number
	): { lineRect: DOMRect; lineRange: Range | null } {
		const cachedLayout = this.getLineLayout(rootElement, scrollX, scrollY);
		const wordMiddleY = wordRect.top + wordRect.height / 2;
		let lineItem = cachedLayout.lines.find(
			(line) => wordMiddleY >= line.rect.top - LINE_Y_TOLERANCE && wordMiddleY <= line.rect.bottom + LINE_Y_TOLERANCE
		);

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

		const lineRange = createTextRange(rootElement, lineItem.startOffset, Math.max(1, lineItem.endOffset - lineItem.startOffset));
		return { lineRect: lineItem.rect, lineRange };
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

	private removeLineHighlight(): void {
		this.lineHighlight?.remove();
		this.lineHighlight = null;
	}
}
