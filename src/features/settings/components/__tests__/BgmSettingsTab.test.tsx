// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BgmSettingsTab } from '../BgmSettingsTab';
import { useReaderConfigStore } from '../../../../stores/useReaderConfigStore';

describe('BgmSettingsTab Component UI & Store Integration', () => {
  let mockAudioContext: any;
  let mockGainNode: any;
  let mockSourceNode: any;
  let mockAudioBuffer: any;

  beforeEach(() => {
    useReaderConfigStore.setState({
      bgmEnabled: true,
      bgmVolume: 0.2,
      bgmAudioUrl: '/audio/ambient-bgm.mp3',
      bgmFadeInMs: 500,
      bgmFadeOutMs: 800,
      bgmStopDelayMs: 1500,
      bgmOnlyOnEdgeReadAloud: true,
    });

    mockAudioBuffer = { duration: 10 };
    mockGainNode = {
      gain: { value: 0.2, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockSourceNode = {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    mockAudioContext = {
      state: 'running',
      currentTime: 0,
      createGain: vi.fn(() => mockGainNode),
      createBufferSource: vi.fn(() => mockSourceNode),
      createBuffer: vi.fn(() => mockAudioBuffer),
      decodeAudioData: vi.fn().mockResolvedValue(mockAudioBuffer),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const MockAudioCtx = vi.fn().mockImplementation(function () {
      return mockAudioContext;
    });
    (window as any).AudioContext = MockAudioCtx;

    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('QC-UI-1: Hiển thị giao diện cài đặt nhạc nền và cho phép chọn Preset âm thanh', async () => {
    render(<BgmSettingsTab />);

    expect(screen.getByText('Nhạc Nền Đọc Sách')).toBeDefined();
    expect(screen.getByText('Tổng hợp Synth Ambient')).toBeDefined();
    expect(screen.getByText('Lofi Piano Thư Giãn')).toBeDefined();

    // Click chọn preset Lofi Piano
    const lofiCard = screen.getByText('Lofi Piano Thư Giãn').closest('button');
    if (lofiCard) {
      fireEvent.click(lofiCard);
    }

    expect(useReaderConfigStore.getState().bgmAudioUrl).toBe('/audio/lofi-piano.mp3');
  });

  it('QC-UI-2: Kéo slider âm lượng hoặc bấm chip tỷ lệ phần trăm cập nhật store bgmVolume', () => {
    render(<BgmSettingsTab />);

    // Click chip 10%
    const chip10 = screen.getAllByText('10%')[0];
    fireEvent.click(chip10);
    expect(useReaderConfigStore.getState().bgmVolume).toBe(0.1);

    // Click chip 35%
    const chip35 = screen.getAllByText('35%')[0];
    fireEvent.click(chip35);
    expect(useReaderConfigStore.getState().bgmVolume).toBe(0.35);
  });

  it('QC-UI-3: Nút Bật/Tắt master toggle cập nhật bgmEnabled trong store', () => {
    render(<BgmSettingsTab />);

    const toggleBtn = screen.getAllByLabelText('Chuyển đổi bật tắt nhạc nền')[0];
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(useReaderConfigStore.getState().bgmEnabled).toBe(false);

    fireEvent.click(toggleBtn);
    expect(useReaderConfigStore.getState().bgmEnabled).toBe(true);
  });
});
