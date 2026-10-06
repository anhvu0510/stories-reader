interface ScrollFollowerEnvironment {
	getScrollY: () => number;
	getViewportHeight: () => number;
	scrollTo: (top: number) => void;
	requestFrame: (callback: FrameRequestCallback) => number;
	cancelFrame: (handle: number) => void;
	prefersReducedMotion: () => boolean;
}

const createBrowserEnvironment = (): ScrollFollowerEnvironment => ({
	getScrollY: () => window.scrollY,
	getViewportHeight: () => window.innerHeight,
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
 * - Giữ quyền cuộn cho người dùng đến khi họ chủ động bắt đầu đọc/điều hướng lại.
 */
export class ReadAloudScrollFollower {
	private targetY: number | null = null;
	private animationFrame: number | null = null;
	private following = true;

	constructor(private readonly environment: ScrollFollowerEnvironment = createBrowserEnvironment()) {}

	/**
	 * Thông báo rằng người dùng đang tương tác chạm/cuộn màn hình.
 * Hủy ngay lập tức animation cuộn tự động và nhường quyền cuộn cho người dùng.
	 */
	public notifyUserInteraction(): void {
		this.following = false;
		this.cancel();
	}

	/** Only an explicit playback/navigation action restores following. */
	public resumeFollowing(): void {
		this.cancel();
		this.following = true;
	}

	public follow(line: DOMRect): void {
		// Nếu người dùng vừa chạm/cuộn màn hình: nhường quyền thao tác hoàn toàn cho người dùng
		if (!this.following) {
			this.cancel();
			return;
		}

		const scrollY = this.environment.getScrollY();
		const viewportHeight = this.environment.getViewportHeight();
		const viewportTop = line.top - scrollY;
		const viewportBottom = line.bottom - scrollY;

		// 1. Nếu dòng highlight đã trôi lên trên khỏi đỉnh màn hình (do người dùng cuộn xuống dưới):
		// Tuyệt đối không cuộn giật ngược về lại, thả tự do cho người dùng đọc/thao tác tiếp
		if (viewportBottom < 0) {
			this.cancel();
			return;
		}

		// 2. Nếu dòng highlight nằm quá xa phía dưới màn hình (người dùng đã cuộn lên trên đỉnh xem lại):
		// Không tự động giật màn hình nhảy xuống
		if (viewportTop > viewportHeight * 1.8) {
			this.cancel();
			return;
		}

		// Nếu dòng highlight vẫn đang nằm trong vùng đọc thoải mái (25% -> 72% màn hình): không cần cuộn
		const safeTop = viewportHeight * 0.25;
		const safeBottom = viewportHeight * 0.72;
		if (viewportTop >= safeTop && viewportBottom <= safeBottom) {
			return;
		}

		this.targetY = Math.max(0, line.top + line.height / 2 - viewportHeight * 0.46);
		if (this.environment.prefersReducedMotion()) {
			this.environment.scrollTo(this.targetY);
			this.targetY = null;
			return;
		}

		if (this.animationFrame === null) {
			this.animationFrame = this.environment.requestFrame(this.tick);
		}
	}

	public cancel(): void {
		if (this.animationFrame !== null) {
			this.environment.cancelFrame(this.animationFrame);
		}
		this.animationFrame = null;
		this.targetY = null;
	}

	private readonly tick: FrameRequestCallback = () => {
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

		this.environment.scrollTo(currentY + distance * 0.16);
		this.animationFrame = this.environment.requestFrame(this.tick);
	};
}
