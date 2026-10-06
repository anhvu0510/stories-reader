interface ScrollFollowerEnvironment {
	getScrollY: () => number;
	getViewportHeight: () => number;
	getMaxScrollY?: () => number;
	hasTextSelection?: () => boolean;
	scrollTo: (top: number) => void;
	requestFrame: (callback: FrameRequestCallback) => number;
	cancelFrame: (handle: number) => void;
	prefersReducedMotion: () => boolean;
}

const createBrowserEnvironment = (): ScrollFollowerEnvironment => ({
	getScrollY: () => window.scrollY,
	getViewportHeight: () => window.innerHeight,
	getMaxScrollY: () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
	hasTextSelection: () => Boolean(window.getSelection()?.toString().trim()),
	scrollTo: (top) => window.scrollTo({ top, behavior: 'auto' }),
	requestFrame: (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle) => window.cancelAnimationFrame(handle),
	prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
});

/**
 * Quản lý cuộn trang mượt mà bám theo dòng chữ đang đọc.
 * Cơ chế thông minh:
 * - Khi dòng highlight đang có mặt trên màn hình: tự động cuộn nhẹ theo dòng highlight.
 * - Khi người dùng vuốt/cuộn màn hình (user scrolling): tạm ngưng auto-scroll để người dùng thao tác.
 * - Tiếp quản lại sau khi thao tác dừng và dòng đang đọc nằm trong viewport.
 */
export class ReadAloudScrollFollower {
	private targetY: number | null = null;
	private animationFrame: number | null = null;
	private following = true;
	private latestLine: DOMRect | null = null;
	private userHolding = false;
	private resumeTimer: ReturnType<typeof setTimeout> | null = null;
	private lastFrameTime: number | null = null;

	constructor(private readonly environment: ScrollFollowerEnvironment = createBrowserEnvironment()) {}

	/**
	 * Thông báo rằng người dùng đang tương tác chạm/cuộn màn hình.
 * Hủy ngay lập tức animation cuộn tự động và nhường quyền cuộn cho người dùng.
	 */
	public notifyUserInteraction(): void {
		this.following = false;
		this.stopAnimation();
		this.scheduleReclaim();
	}

	public beginUserInteraction(): void {
		this.userHolding = true;
		this.notifyUserInteraction();
	}

	public endUserInteraction(): void {
		this.userHolding = false;
		this.notifyUserInteraction();
	}

	/** User momentum extends the quiet period; our own animation scrolls do not. */
	public notifyViewportScroll(): void {
		if (this.following) return;
		this.scheduleReclaim();
	}

	public notifySelectionChange(): void {
		if (this.environment.hasTextSelection?.()) {
			this.notifyUserInteraction();
			return;
		}
		this.notifyViewportScroll();
	}

	private scheduleReclaim(): void {
		this.clearResumeTimer();
		this.resumeTimer = setTimeout(this.reclaimIfVisible, 250);
	}

	private readonly reclaimIfVisible = (): void => {
		this.resumeTimer = null;
		if (this.userHolding || !this.latestLine || this.environment.hasTextSelection?.()) return;
		const top = this.latestLine.top - this.environment.getScrollY();
		const bottom = this.latestLine.bottom - this.environment.getScrollY();
		if (top < 0 || bottom > this.environment.getViewportHeight()) return;
		this.following = true;
		this.follow(this.latestLine, true);
	};

	private clearResumeTimer(): void {
		if (this.resumeTimer !== null) clearTimeout(this.resumeTimer);
		this.resumeTimer = null;
	}

	/** Only an explicit playback/navigation action restores following. */
	public resumeFollowing(): void {
		this.cancel();
		this.userHolding = false;
		this.following = true;
	}

	public follow(line: DOMRect, recenter = false): void {
		this.latestLine = line;
		if (this.environment.hasTextSelection?.()) this.notifyUserInteraction();
		// Nếu người dùng vừa chạm/cuộn màn hình: nhường quyền thao tác hoàn toàn cho người dùng
		if (!this.following) {
			this.ensureReclaimScheduled();
			return;
		}

		const scrollY = this.environment.getScrollY();
		const viewportHeight = this.environment.getViewportHeight();
		const viewportTop = line.top - scrollY;
		const viewportBottom = line.bottom - scrollY;

		// 1. Nếu dòng highlight đã trôi lên trên khỏi đỉnh màn hình (do người dùng cuộn xuống dưới):
		// Tuyệt đối không cuộn giật ngược về lại, thả tự do cho người dùng đọc/thao tác tiếp
		if (viewportBottom < 0) {
			this.stopAnimation();
			return;
		}

		// 2. Nếu dòng highlight nằm quá xa phía dưới màn hình (người dùng đã cuộn lên trên đỉnh xem lại):
		// Không tự động giật màn hình nhảy xuống
		if (viewportTop > viewportHeight * 1.8) {
			this.stopAnimation();
			return;
		}

		if (!recenter && viewportTop >= viewportHeight * 0.25 && viewportBottom <= viewportHeight * 0.75) return;
		const maxScrollY = this.environment.getMaxScrollY?.() ?? Infinity;
		this.targetY = Math.min(maxScrollY, Math.max(0, line.top + line.height / 2 - viewportHeight * 0.5));
		if (Math.abs(this.targetY - scrollY) < 0.75) return;
		if (this.environment.prefersReducedMotion()) {
			this.environment.scrollTo(this.targetY);
			this.targetY = null;
			return;
		}

		if (this.animationFrame === null) {
			this.lastFrameTime = null;
			this.animationFrame = this.environment.requestFrame(this.tick);
		}
	}

	private ensureReclaimScheduled(): void {
		if (this.resumeTimer !== null) return;
		this.scheduleReclaim();
	}

	public cancel(): void {
		this.clearResumeTimer();
		this.latestLine = null;
		this.stopAnimation();
	}

	private stopAnimation(): void {
		if (this.animationFrame !== null) {
			this.environment.cancelFrame(this.animationFrame);
		}
		this.animationFrame = null;
		this.targetY = null;
		this.lastFrameTime = null;
	}

	private readonly tick: FrameRequestCallback = (timestamp) => {
		if (this.targetY === null) {
			this.animationFrame = null;
			return;
		}

		// Nếu người dùng bắt đầu vuốt ngón tay trong lúc animation đang chạy: dừng ngay
		if (!this.following) {
			this.cancel();
			return;
		}

		const currentY = this.environment.getScrollY();
		const distance = this.targetY - currentY;
		if (Math.abs(distance) < 0.75) {
			this.environment.scrollTo(this.targetY);
			this.animationFrame = null;
			this.targetY = null;
			return;
		}

		const elapsed = this.lastFrameTime === null ? 16.67 : Math.min(64, timestamp - this.lastFrameTime);
		this.lastFrameTime = timestamp;
		const easing = 1 - Math.exp(-elapsed / 100);
		this.environment.scrollTo(currentY + distance * easing);
		this.animationFrame = this.environment.requestFrame(this.tick);
	};
}
