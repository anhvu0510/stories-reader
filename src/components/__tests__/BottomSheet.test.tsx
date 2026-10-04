// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { BottomSheet } from '@/components/BottomSheet';

describe('BottomSheet Component', () => {
	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders children when isOpen is true', () => {
		render(
			<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Test Sheet">
				<div>Sheet Content</div>
			</BottomSheet>
		);

		expect(screen.getByText('Sheet Content')).toBeDefined();
		expect(screen.getByRole('dialog')).toBeDefined();
	});

	it('does not render content when isOpen is false', () => {
		render(
			<BottomSheet isOpen={false} onClose={mockOnClose} ariaLabel="Test Sheet">
				<div>Sheet Content</div>
			</BottomSheet>
		);

		expect(screen.queryByText('Sheet Content')).toBeNull();
	});

	it('calls onClose when backdrop is clicked', () => {
		render(
			<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Test Sheet">
				<div>Sheet Content</div>
			</BottomSheet>
		);

		const backdrop = screen.getByTestId('bottom-sheet-backdrop');
		fireEvent.click(backdrop);

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('applies crystal transparent glass styling by default or when glassmorphic is true', () => {
		render(
			<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Glass Sheet">
				<div>Sheet Content</div>
			</BottomSheet>
		);

		const sheetContainer = screen.getByTestId('bottom-sheet-container');
		const backdrop = screen.getByTestId('bottom-sheet-backdrop');

		expect(sheetContainer.className).toContain('backdrop-blur-sm');
		expect(sheetContainer.className).toContain('color-mix');
		expect(backdrop.className).toContain('bg-black/15');
		expect(backdrop.className).toContain('backdrop-blur-[1.5px]');
	});

	it('mounts directly to document.body via portal and not inside parent container', () => {
		const { container } = render(
			<div id="nested-parent">
				<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Portal Sheet">
					<div>Portal Content</div>
				</BottomSheet>
			</div>
		);

		const dialog = screen.getByRole('dialog');
		expect(dialog.parentElement).toBe(document.body);
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		expect(dialog.getAttribute('data-sheet-open')).toBe('true');
		expect(dialog.className).toContain('bottom-sheet');
	});

	it('triggers onClose when swiping down past commit threshold (deltaY > 70px)', async () => {
		vi.useFakeTimers();
		render(
			<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Swipe Sheet">
				<div>Swipeable Content</div>
			</BottomSheet>
		);

		const sheetContainer = screen.getByTestId('bottom-sheet-container');

		fireEvent.touchStart(sheetContainer, {
			touches: [{ clientX: 200, clientY: 100 }]
		});

		fireEvent.touchMove(sheetContainer, {
			touches: [{ clientX: 200, clientY: 220 }]
		});

		fireEvent.touchEnd(sheetContainer);

		vi.advanceTimersByTime(250);
		expect(mockOnClose).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('does not trigger onClose when swiping down below threshold (deltaY <= 70px)', async () => {
		vi.useFakeTimers();
		render(
			<BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Swipe Sheet">
				<div>Swipeable Content</div>
			</BottomSheet>
		);

		const sheetContainer = screen.getByTestId('bottom-sheet-container');

		fireEvent.touchStart(sheetContainer, {
			touches: [{ clientX: 200, clientY: 100 }]
		});

		fireEvent.touchMove(sheetContainer, {
			touches: [{ clientX: 200, clientY: 130 }]
		});

		vi.advanceTimersByTime(200);
		fireEvent.touchEnd(sheetContainer);

		vi.advanceTimersByTime(300);
		expect(mockOnClose).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
});
