// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEdgeReadAloudBgm, isEdgeReadAloudActive } from '../useEdgeReadAloudBgm';

describe('useEdgeReadAloudBgm Hook', () => {
  let mockAudioContext: any;
  let mockGainNode: any;
  let mockCompressorNode: any;
  let mockSourceNode: any;
  let mockAudioBuffer: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockAudioBuffer = { duration: 10 };
    mockGainNode = {
      gain: {
        value: 0.15,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockCompressorNode = {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
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
      createDynamicsCompressor: vi.fn(() => mockCompressorNode),
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
        volume: 0.15,
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
        volume: 0.15,
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
    expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.00225, 0.1);
  });

  it('QC-4: Dừng nhạc mượt mà (Fade Out & Stop) sau khi ngắt class và hết khoảng trễ stopDelayMs', async () => {
    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
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

  it('QC-7: Cho phép người dùng bật BGM thủ công qua toggleBgm()', async () => {
    const { result } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(false);

    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });

    expect(mockSourceNode.start).toHaveBeenCalledWith(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it('QC-8: Cho phép người dùng tắt BGM thủ công khi đang phát', async () => {
    const { result } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
        fadeOutMs: 100,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(true);

    await act(async () => {
      result.current.toggleBgm();
    });
    expect(result.current.isPlaying).toBe(false);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockSourceNode.stop).toHaveBeenCalled();
  });

  it('QC-9: BGM bật thủ công không bị dừng khi Edge Read Aloud ngắt trạng thái', async () => {
    const { result } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
        stopDelayMs: 200,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Bật BGM thủ công
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(true);

    // Kích hoạt DOM Edge Read Aloud
    await act(async () => {
      const p = document.createElement('p');
      p.className = 'msreadout-line-highlight';
      document.body.appendChild(p);
    });

    // Ngắt DOM Edge Read Aloud
    await act(async () => {
      document.body.innerHTML = '';
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Vẫn đang phát vì là bật thủ công
    expect(mockSourceNode.stop).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('QC-10: Sử dụng DynamicsCompressorNode để tránh xung đột âm lượng trên mobile', async () => {
    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
      })
    );

    await act(async () => {
      const p = document.createElement('p');
      p.className = 'msreadout-line-highlight';
      document.body.appendChild(p);
    });

    expect(mockAudioContext.createDynamicsCompressor).toHaveBeenCalled();
    expect(mockCompressorNode.threshold.setValueAtTime).toHaveBeenCalledWith(-24, 0);
    expect(mockCompressorNode.ratio.setValueAtTime).toHaveBeenCalledWith(12, 0);
  });

  it('QC-11: Nút bật/tắt thủ công (toggleBgm) ghi đè thống nhất flow auto, không bị MutationObserver ép phát lại khi user đã tắt', async () => {
    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    const { result } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
        fadeOutMs: 100,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Auto flow đã bật BGM vì đang đọc
    expect(result.current.isPlaying).toBe(true);

    // Người dùng bấm TẮT nhạc nền thủ công
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(false);

    // Giả lập DOM MutationObserver tiếp tục thay đổi class highlight khi đọc câu tiếp theo
    await act(async () => {
      p.className = 'msreadout-word-highlight';
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // BGM phải giữ nguyên trạng thái TẮT (không bị auto flow ép bật lại)
    expect(result.current.isPlaying).toBe(false);

    // Bấm BẬT lại thủ công -> Phải phát lại bình thường
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(true);
  });

  it('QC-12: Mở khóa âm thanh tự động trên Mobile (pointerdown/touchstart) khi AudioContext bắt đầu ở trạng thái suspended', async () => {
    mockAudioContext.state = 'suspended';

    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Giả lập sự kiện touchstart trên trình duyệt mobile
    await act(async () => {
      mockAudioContext.state = 'running';
      window.dispatchEvent(new Event('touchstart'));
      await Promise.resolve();
    });

    expect(mockAudioContext.resume).toHaveBeenCalled();
  });

  it('QC-13: Cập nhật âm lượng Real-time khi prop volume thay đổi trong lúc BGM đang phát', async () => {
    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    const { rerender, result } = renderHook(
      (props) =>
        useEdgeReadAloudBgm({
          audioUrl: '/audio/test.mp3',
          volume: props.volume,
        }),
      { initialProps: { volume: 0.10 } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(true);

    // Thay đổi slider âm lượng sang 0.20
    await act(async () => {
      rerender({ volume: 0.20 });
      await Promise.resolve();
    });

    expect(mockGainNode.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.004000000000000001, 0.5);
  });

  it('QC-14: Tắt ngay lập tức BGM khi prop enabled chuyển sang false', async () => {
    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    const { rerender, result } = renderHook(
      (props) =>
        useEdgeReadAloudBgm({
          audioUrl: '/audio/test.mp3',
          volume: 0.15,
          enabled: props.enabled,
          fadeOutMs: 50,
        }),
      { initialProps: { enabled: true } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isPlaying).toBe(true);

    // Tắt cờ master enabled trong settings
    rerender({ enabled: false });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockSourceNode.stop).toHaveBeenCalled();
  });

  it('QC-15: Tự động khôi phục và sinh ambient buffer fallback nếu tải audio hoặc worker bị gián đoạn', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network offline'));

    const p = document.createElement('p');
    p.className = 'msreadout-line-highlight';
    document.body.appendChild(p);

    renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/missing.mp3',
        volume: 0.15,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Phải tạo buffer fallback C-Major chord thành công
    expect(mockAudioContext.createBuffer).toHaveBeenCalled();
    expect(mockSourceNode.start).toHaveBeenCalledWith(0);
  });

  it('QC-16: Nút toggleBgm hoạt động ổn định liên tục qua nhiều lần nhấn (Click 1: BẬT, Click 2: TẮT, Click 3: BẬT, Click 4: TẮT) không bị kẹt hay desync', async () => {
    const { result } = renderHook(() =>
      useEdgeReadAloudBgm({
        audioUrl: '/audio/test.mp3',
        volume: 0.15,
        fadeOutMs: 100,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Initial state: OFF
    expect(result.current.isPlaying).toBe(false);

    // Click 1: ON
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(true);

    // Click 2: OFF
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(false);

    // Click 3: ON
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(true);

    // Click 4: OFF
    await act(async () => {
      result.current.toggleBgm();
      await Promise.resolve();
    });
    expect(result.current.isPlaying).toBe(false);
  });
});
