// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { VoiceSettingsTab } from '@/features/settings/components/VoiceSettingsTab';
import { useReaderConfigStore } from '@/stores/useReaderConfigStore';

vi.mock('@/services/edgeTtsService', async (importOriginal) => {
	const actual = await importOriginal<any>();
	return {
		...actual,
		EdgeTTSService: {
			...actual.EdgeTTSService,
			isSupported: vi.fn(() => true),
			fetchVoices: vi.fn().mockResolvedValue([]),
			playPreview: vi.fn(),
			stop: vi.fn()
		}
	};
});

vi.mock('@/services/nativeTtsService', async (importOriginal) => {
	const actual = await importOriginal<any>();
	return {
		...actual,
		NativeTTSService: {
			...actual.NativeTTSService,
			isNative: vi.fn(() => false),
			getVoices: vi.fn().mockResolvedValue([]),
			getVietnameseVoices: vi.fn((voices: any[]) => voices.filter((v: any) => v.lang?.startsWith('vi'))),
			playPreview: vi.fn(),
			stop: vi.fn().mockResolvedValue(undefined)
		}
	};
});

describe('VoiceSettingsTab Component', () => {
	beforeEach(() => {
		useReaderConfigStore.setState({
			ttsEngine: 'edge',
			speechRate: 1.0,
			edgeVoiceUri: 'vi-VN-HoaiMyNeural',
			edgeBufferMode: 'file',
			voiceUri: ''
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders category buttons (Edge Cloud, VieNeu AI, Thiết bị)', () => {
		render(<VoiceSettingsTab />);
		expect(screen.getByRole('button', { name: /Edge Cloud/i })).toBeDefined();
		expect(screen.getByRole('button', { name: /VieNeu AI/i })).toBeDefined();
		expect(screen.getByRole('button', { name: /Thiết bị/i })).toBeDefined();
	});

	it('switches category and selects a voice card', async () => {
		render(<VoiceSettingsTab />);
		const deviceBtn = screen.getByRole('button', { name: /Thiết bị/i });
		fireEvent.click(deviceBtn);

		const deviceCard = await screen.findByText('Mặc định thiết bị');
		fireEvent.click(deviceCard);

		expect(useReaderConfigStore.getState().ttsEngine).toBe('browser');
	});

	it('updates speed through quick speed preset buttons', () => {
		render(<VoiceSettingsTab />);
		const preset15 = screen.getByText('1.5x');
		fireEvent.click(preset15);

		expect(useReaderConfigStore.getState().speechRate).toBe(1.5);
	});

	it('steps speed up and down via stepper buttons', () => {
		render(<VoiceSettingsTab />);
		const plusBtn = screen.getByTitle(/Tăng 0.05x/i);
		fireEvent.click(plusBtn);

		expect(useReaderConfigStore.getState().speechRate).toBeCloseTo(1.05);
	});

	it('offers Media3 as an isolated Edge buffer mode and persists the selection', () => {
		render(<VoiceSettingsTab />);
		fireEvent.click(screen.getByRole('button', { name: /Cài đặt máy chủ & kỹ thuật/i }));

		const media3Button = screen.getByRole('button', { name: /Media3/i });
		fireEvent.click(media3Button);

		expect(useReaderConfigStore.getState().edgeBufferMode).toBe('media3');
		expect(screen.getByText(/phát progressive/i)).toBeDefined();
	});
});
