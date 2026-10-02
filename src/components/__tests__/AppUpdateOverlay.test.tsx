// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppUpdateOverlay } from '../AppUpdateOverlay';

describe('AppUpdateOverlay Component (TDD)', () => {
	it('should render nothing when isUpdating is false', () => {
		const { container } = render(
			<AppUpdateOverlay isUpdating={false} progress={0} statusMessage="" />
		);
		expect(container.firstChild).toBeNull();
	});

	it('should render full overlay when isUpdating is true', () => {
		render(
			<AppUpdateOverlay
				isUpdating={true}
				progress={65}
				statusMessage="Đang tải bản cập nhật: 65%"
			/>
		);

		expect(screen.getByText(/Đang cập nhật phiên bản mới/i)).toBeTruthy();
		expect(screen.getAllByText(/65%/i).length).toBeGreaterThanOrEqual(1);
		expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('65');
	});
});
