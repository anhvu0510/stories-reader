// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useCupertinoSwipeBack } from '@/hooks/useCupertinoSwipeBack';
import { useModalStore } from '@/stores/useModalStore';

describe('useCupertinoSwipeBack Hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('không kích hoạt khi người dùng chạm vào ngoài vùng mép màn hình (startX > edgeWidth)', () => {
		const onBack = vi.fn();
		renderHook(() =>
			useCupertinoSwipeBack({
				onBack,
				edgeWidth: 28
			})
		);

		act(() => {
			// Chạm ở giữa màn hình (x = 100 > 28)
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 200, clientY: 200 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 200, clientY: 200 } as any]
				})
			);
		});

		expect(onBack).not.toHaveBeenCalled();
	});

	it('kích hoạt onBack khi vuốt từ mép trái (>28px) sang phải vượt quá ngưỡng cam kết (threshold)', () => {
		const onBack = vi.fn();
		const onSwipeProgress = vi.fn();

		renderHook(() =>
			useCupertinoSwipeBack({
				onBack,
				onSwipeProgress,
				edgeWidth: 28,
				threshold: 80
			})
		);

		act(() => {
			// Chạm ở sát mép trái (x = 15 <= 28)
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 15, clientY: 150 } as any]
				})
			);
			// Kéo sang phải 100px (vượt ngưỡng 80px)
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 115, clientY: 150 } as any]
				})
			);
		});

		expect(onSwipeProgress).toHaveBeenCalledWith(100);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 115, clientY: 150 } as any]
				})
			);
		});

		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('snap back về 0px và không gọi onBack khi người dùng thả tay trước ngưỡng cam kết', () => {
		const onBack = vi.fn();
		const onSwipeCancel = vi.fn();

		renderHook(() =>
			useCupertinoSwipeBack({
				onBack,
				onSwipeCancel,
				edgeWidth: 28,
				threshold: 120
			})
		);

		act(() => {
			// Chạm mép trái (x = 10 <= 28)
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 10, clientY: 150 } as any]
				})
			);
			// Kéo nhẹ 40px (chưa đủ 120px)
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
			// Thả tay
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 50, clientY: 150 } as any]
				})
			);
		});

		expect(onBack).not.toHaveBeenCalled();
		expect(onSwipeCancel).toHaveBeenCalledTimes(1);
	});

	it('khóa cử chỉ khi di chuyển theo chiều dọc chiếm ưu thế (không nhầm với cuộn trang)', () => {
		const onBack = vi.fn();
		const onSwipeProgress = vi.fn();

		renderHook(() =>
			useCupertinoSwipeBack({
				onBack,
				onSwipeProgress,
				edgeWidth: 28
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 15, clientY: 100 } as any]
				})
			);
			// Di chuyển dọc 50px, ngang 5px -> cuộn dọc
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 20, clientY: 150 } as any]
				})
			);
		});

		expect(onSwipeProgress).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 20, clientY: 150 } as any]
				})
			);
		});

		expect(onBack).not.toHaveBeenCalled();
	});

	it('không kích hoạt cử chỉ khi modal hoặc settings đang mở', () => {
		const onBack = vi.fn();
		useModalStore.setState({ isSettingsOpen: true });

		renderHook(() =>
			useCupertinoSwipeBack({
				onBack,
				edgeWidth: 28
			})
		);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 15, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 120, clientY: 150 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchend', {
					changedTouches: [{ clientX: 120, clientY: 150 } as any]
				})
			);
		});

		expect(onBack).not.toHaveBeenCalled();
		useModalStore.setState({ isSettingsOpen: false });
	});
});

