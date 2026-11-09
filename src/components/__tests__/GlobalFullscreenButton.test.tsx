// @vitest-environment jsdom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { GlobalFullscreenButton } from '../GlobalFullscreenButton';

let mockIsAndroidApp = false;

vi.mock('@/stores/useAppLockStore', () => ({
	isAndroidApp: () => mockIsAndroidApp,
}));

function renderButton(route = '/') {
	return render(
		<MemoryRouter initialEntries={[route]}>
			<GlobalFullscreenButton />
		</MemoryRouter>
	);
}

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

	it('renders an accessible fullscreen control below headers on web', () => {
		renderButton('/');
		const btn = screen.getByTestId('global-fullscreen-btn');
		expect(btn).toBeDefined();
		expect(btn.getAttribute('aria-label')).toBe('Bật toàn màn hình');
		expect(btn.className).toContain('28rem');
		expect(btn.className).toContain('h-[30px]');
		expect(btn.className).toContain('w-[30px]');
		expect(btn.className).toContain('bg-surface-container');
		expect(btn.className).toContain('text-primary');
		expect(btn.className).toContain('focus-visible:ring-2');
	});

	it('aligns the fullscreen control with the wider reader column', () => {
		renderButton('/book/story/chapter/chapter');
		const btn = screen.getByTestId('global-fullscreen-btn');
		expect(btn.className).toContain('56rem');
		expect(btn.className).toContain('64rem');
	});

	it('enters fullscreen mode and hides the button without showing an exit button', async () => {
		renderButton('/');
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

		renderButton('/');
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
		renderButton('/');
		expect(screen.queryByTestId('global-fullscreen-btn')).toBeNull();
	});
});
