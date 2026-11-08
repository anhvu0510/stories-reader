// @vitest-environment jsdom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GlobalFullscreenButton } from '../GlobalFullscreenButton';

let mockIsAndroidApp = false;

vi.mock('@/stores/useAppLockStore', () => ({
	isAndroidApp: () => mockIsAndroidApp,
}));

describe('GlobalFullscreenButton Component', () => {
	beforeEach(() => {
		cleanup();
		vi.restoreAllMocks();
		mockIsAndroidApp = false;
		Object.defineProperty(document, 'fullscreenElement', {
			value: null,
			writable: true,
			configurable: true,
		});
		document.documentElement.requestFullscreen = vi.fn().mockImplementation(async () => {
			Object.defineProperty(document, 'fullscreenElement', {
				value: document.documentElement,
				writable: true,
				configurable: true,
			});
			document.dispatchEvent(new Event('fullscreenchange'));
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders small fullscreen icon at bottom-right when not in fullscreen mode on web', () => {
		render(<GlobalFullscreenButton />);
		const btn = screen.getByTestId('global-fullscreen-btn');
		expect(btn).toBeDefined();
		expect(btn.getAttribute('aria-label')).toBe('Toàn màn hình');
	});

	it('enters fullscreen mode and hides the button without showing an exit button', async () => {
		render(<GlobalFullscreenButton />);
		const btn = screen.getByTestId('global-fullscreen-btn');

		await act(async () => {
			fireEvent.click(btn);
		});

		expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId('global-fullscreen-btn')).toBeNull();
	});

	it('reappears automatically when user exits fullscreen (e.g. swipe back gesture)', async () => {
		Object.defineProperty(document, 'fullscreenElement', {
			value: document.documentElement,
			writable: true,
			configurable: true,
		});

		render(<GlobalFullscreenButton />);
		expect(screen.queryByTestId('global-fullscreen-btn')).toBeNull();

		act(() => {
			Object.defineProperty(document, 'fullscreenElement', {
				value: null,
				writable: true,
				configurable: true,
			});
			document.dispatchEvent(new Event('fullscreenchange'));
		});

		expect(screen.getByTestId('global-fullscreen-btn')).toBeDefined();
	});

	it('does not render on native Android app', () => {
		mockIsAndroidApp = true;
		render(<GlobalFullscreenButton />);
		expect(screen.queryByTestId('global-fullscreen-btn')).toBeNull();
	});
});
