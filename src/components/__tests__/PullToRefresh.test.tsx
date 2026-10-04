// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';

import { PullToRefresh } from '@/components/PullToRefresh';

describe('PullToRefresh component', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
		window.scrollY = 0;
	});

	afterEach(() => {
		cleanup();
	});

	it('renders indicator hidden initially on android', () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(<PullToRefresh onRefresh={onRefresh} />);

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.getAttribute('aria-hidden')).toBe('true');
	});

	it('activates and shows indicator during pull-down on android', () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(<PullToRefresh onRefresh={onRefresh} threshold={50} />);

		act(() => {
			window.dispatchEvent(
				new TouchEvent('touchstart', {
					touches: [{ clientX: 100, clientY: 50 } as any]
				})
			);
			window.dispatchEvent(
				new TouchEvent('touchmove', {
					touches: [{ clientX: 100, clientY: 180 } as any],
					cancelable: true
				})
			);
		});

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.getAttribute('aria-hidden')).toBe('false');
	});

	it('suppresses indicator rendering when showIndicator is false', () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined);
		render(<PullToRefresh onRefresh={onRefresh} showIndicator={false} />);

		expect(screen.queryByTestId('pull-to-refresh-indicator')).toBeNull();
	});
});
