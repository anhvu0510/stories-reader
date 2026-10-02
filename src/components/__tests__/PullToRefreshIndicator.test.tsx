// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';

describe('PullToRefreshIndicator', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders hidden when pullDistance is 0 and not refreshing', () => {
		render(
			<PullToRefreshIndicator
				pullDistance={0}
				isRefreshing={false}
				hasTriggeredThreshold={false}
			/>
		);

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.getAttribute('aria-hidden')).toBe('true');
		expect(indicator.style.opacity).toBe('0');
	});

	it('renders pure icon with zero text content (native mobile style)', () => {
		render(
			<PullToRefreshIndicator
				pullDistance={45}
				isRefreshing={false}
				hasTriggeredThreshold={false}
			/>
		);

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.textContent?.trim()).toBe('');
		const svg = indicator.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.classList.contains('lucide-rotate-cw')).toBe(true);
	});

	it('becomes visible when pulling (pullDistance > 0)', () => {
		render(
			<PullToRefreshIndicator
				pullDistance={75}
				isRefreshing={false}
				hasTriggeredThreshold={true}
			/>
		);

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.getAttribute('aria-hidden')).toBe('false');
		expect(Number(indicator.style.opacity)).toBeGreaterThan(0.5);
	});

	it('spins the icon when isRefreshing is true', () => {
		render(
			<PullToRefreshIndicator
				pullDistance={0}
				isRefreshing={true}
				hasTriggeredThreshold={true}
			/>
		);

		const indicator = screen.getByTestId('pull-to-refresh-indicator');
		expect(indicator.getAttribute('aria-hidden')).toBe('false');
		const svg = indicator.querySelector('svg');
		expect(svg?.classList.contains('animate-spin')).toBe(true);
	});
});
