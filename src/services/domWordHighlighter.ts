interface HighlightRegistryLike {
  set(name: string, highlight: unknown): void;
  delete(name: string): boolean;
}

interface HighlightConstructorLike {
  new (...ranges: Range[]): unknown;
}

interface CachedLineLayout {
  lines: DOMRect[];
  textLength: number;
}

export interface ReadAloudHighlightGeometry {
  line: DOMRect;
  word: DOMRect;
}

const CSS_HIGHLIGHT_NAME = 'msreadout-word';
const LINE_Y_TOLERANCE = 2;

export class DomWordHighlighter {
  private readonly className: string;
  private marks: HTMLElement[] = [];
  private lineHighlight: HTMLElement | null = null;
  private readonly lineLayoutCache = new WeakMap<HTMLElement, CachedLineLayout>();
  private observedRoot: HTMLElement | null = null;
  private readonly resizeObserver?: ResizeObserver;

  constructor(className: string) {
    this.className = className;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => this.lineLayoutCache.delete(entry.target as HTMLElement));
      });
    }
  }

  public highlight(
    rootElement: HTMLElement,
    startOffset: number,
    length: number
  ): ReadAloudHighlightGeometry | null {
    this.clearWordHighlight();
    if (length <= 0) {
      this.removeLineHighlight();
      return null;
    }

    const wordRange = this.createTextRange(rootElement, startOffset, length);
    if (!wordRange) {
      this.removeLineHighlight();
      return null;
    }

    const registry = this.getHighlightRegistry();
    const HighlightConstructor = this.getHighlightConstructor();
    let wordRects: DOMRect[];

    if (registry && HighlightConstructor) {
      registry.set(CSS_HIGHLIGHT_NAME, new HighlightConstructor(wordRange));
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
    const documentWordRect = new DOMRect(
      viewportWordRect.left + scrollX,
      viewportWordRect.top + scrollY,
      viewportWordRect.width,
      viewportWordRect.height
    );
    const documentLineRect = this.findLineRect(rootElement, documentWordRect, scrollX, scrollY);

    this.updateLineHighlight(documentLineRect);
    return { line: documentLineRect, word: documentWordRect };
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
    return (
      (globalThis as typeof globalThis & { Highlight?: HighlightConstructorLike }).Highlight ?? null
    );
  }

  private createTextRange(
    rootElement: HTMLElement,
    startOffset: number,
    length: number
  ): Range | null {
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
    const mark = document.createElement('msreadoutspan');
    mark.className = this.className;
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    this.marks.push(mark);
  }

  private clearWordHighlight(): void {
    this.getHighlightRegistry()?.delete(CSS_HIGHLIGHT_NAME);
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

  private findLineRect(
    rootElement: HTMLElement,
    wordRect: DOMRect,
    scrollX: number,
    scrollY: number
  ): DOMRect {
    const textLength = rootElement.textContent?.length ?? 0;
    let cachedLayout = this.lineLayoutCache.get(rootElement);
    if (!cachedLayout || cachedLayout.textLength !== textLength) {
      const contentRange = document.createRange();
      contentRange.selectNodeContents(rootElement);
      const documentRects = Array.from(contentRange.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map(
          (rect) =>
            new DOMRect(rect.left + scrollX, rect.top + scrollY, rect.width, rect.height)
        );
      cachedLayout = {
        lines: this.mergeLineFragments(documentRects),
        textLength,
      };
      this.lineLayoutCache.set(rootElement, cachedLayout);
      if (this.resizeObserver && this.observedRoot !== rootElement) {
        if (this.observedRoot) this.resizeObserver.unobserve(this.observedRoot);
        this.resizeObserver.observe(rootElement);
        this.observedRoot = rootElement;
      }
    }

    const wordMiddleY = wordRect.top + wordRect.height / 2;
    return (
      cachedLayout.lines.find(
        (line) => wordMiddleY >= line.top - 1 && wordMiddleY <= line.bottom + 1
      ) ?? wordRect
    );
  }

  private mergeLineFragments(rects: DOMRect[]): DOMRect[] {
    const lines: DOMRect[] = [];
    rects.forEach((rect) => {
      const index = lines.findIndex(
        (line) => Math.abs(line.top - rect.top) <= LINE_Y_TOLERANCE
      );
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
      this.lineHighlight.className = 'msreadout-line-highlight';
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
