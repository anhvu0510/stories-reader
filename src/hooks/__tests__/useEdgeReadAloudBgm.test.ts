// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEdgeReadAloudBgm, isEdgeReadAloudActive } from '../useEdgeReadAloudBgm';

describe('useEdgeReadAloudBgm Hook', () => {
  let mockAudioContext: any;
  let mockGainNode: any;
  let mockSourceNode: any;
  let mockAudioBuffer: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockAudioBuffer = { duration: 10 };
    mockGainNode = {
      gain: {
        value: 0.2,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
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

    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('QC-1: isEdgeReadAloudActive trả về true khi có class/tag highlight của Edge Read Aloud', () => {
    expect(isEdgeReadAloudActive()).toBe(false);

    const span = document.createElement('span');
    span.className = 'msreadout-line-highlight';
    document.body.appendChild(span);

    expect(isEdgeReadAloudActive()).toBe(true);

    span.className = 'msreadout-word-highlight';
    expect(isEdgeReadAloudActive()).toBe(true);

    document.body.innerHTML = '<msreadoutspan>hello</msreadoutspan>';
    expect(isEdgeReadAloudActive()).toBe(true);
  });

  it('QC-2: Khởi tạo hook và không phát BGM khi Edge Read Aloud không active', async () => {
    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.2,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSourceNode.start).not.toHaveBeenCalled();
  });

  it('QC-3: Tự động kích hoạt BGM khi MutationObserver phát hiện class Edge Read Aloud', async () => {
    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.2,
        fadeInMs: 100,
        stopDelayMs: 500,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      const p = document.createElement('p');
      p.className = 'msreadout-line-highlight';
      document.body.appendChild(p);
    });

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockSourceNode.start).toHaveBeenCalledWith(0);
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.2, 0.1);
  });

  it('QC-4: Dừng nhạc mượt mà (Fade Out & Stop) sau khi ngắt class và hết khoảng trễ stopDelayMs', async () => {
    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.2,
        fadeOutMs: 200,
        stopDelayMs: 500,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSourceNode.start).toHaveBeenCalled();

    await act(async () => {
      p.className = '';
    });

    expect(mockSourceNode.stop).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.2);
    expect(mockSourceNode.stop).toHaveBeenCalled();
    expect(mockSourceNode.disconnect).toHaveBeenCalled();
  });

  it('QC-5: Dọn dẹp resource và AudioContext khi component unmount', async () => {
    const { unmount } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it('QC-6: Nhận diện chính xác trạng thái tạm ngưng (inactive highlight) khi user pause Edge Read Aloud', () => {
    const span = document.createElement('span');
    span.className = 'msreadout-line-highlight msreadout-inactive-highlight';
    document.body.appendChild(span);

    expect(isEdgeReadAloudActive()).toBe(false);

    span.className = 'msreadout-line-highlight';
    expect(isEdgeReadAloudActive()).toBe(true);

    span.className = 'msreadout-inactive-line-highlight';
    expect(isEdgeReadAloudActive()).toBe(false);
  });
});
