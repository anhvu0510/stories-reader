// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle, DEFAULT_APP_TITLE } from '../useDocumentTitle';

describe('useDocumentTitle Hook', () => {
  const initialTitle = 'Reader Stories App';

  beforeEach(() => {
    document.title = initialTitle;
  });

  afterEach(() => {
    document.title = initialTitle;
  });

  it('QC-1: Cập nhật title chính xác theo tên truyện', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Phàm Nhân Tu Tiên' },
    });

    expect(document.title).toBe('Phàm Nhân Tu Tiên');
  });

  it('QC-2: Cập nhật title khi chuyển truyện hoặc chương có title mới', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Phàm Nhân Tu Tiên' },
    });

    expect(document.title).toBe('Phàm Nhân Tu Tiên');

    rerender({ title: 'Võ Luyện Đỉnh Phong' });
    expect(document.title).toBe('Võ Luyện Đỉnh Phong');
  });

  it('QC-3: Trim khoảng trắng thừa trong tên truyện', () => {
    renderHook(() => useDocumentTitle('  Đấu Phá Khung Thương  '));
    expect(document.title).toBe('Đấu Phá Khung Thương');
  });

  it('QC-4: Fallback về DEFAULT_APP_TITLE khi title là null, undefined hoặc rỗng', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: undefined as string | undefined },
    });

    expect(document.title).toBe(DEFAULT_APP_TITLE);

    rerender({ title: '' });
    expect(document.title).toBe(DEFAULT_APP_TITLE);

    rerender({ title: '   ' });
    expect(document.title).toBe(DEFAULT_APP_TITLE);
  });

  it('QC-6: Khôi phục title về DEFAULT_APP_TITLE khi component unmount', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Thôn Phệ Tinh Không'));
    expect(document.title).toBe('Thôn Phệ Tinh Không');

    unmount();
    expect(document.title).toBe(DEFAULT_APP_TITLE);
  });
});
