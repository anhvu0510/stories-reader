// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SortSheet, SORT_OPTIONS } from '../SortSheet';

describe('SortSheet Component Tests', () => {
  const mockOnApply = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all sort options when open', () => {
    render(
      <SortSheet
        isOpen={true}
        currentSortBy="updatedAt"
        currentSortOrder="DESC"
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Sắp xếp danh sách')).toBeDefined();
    expect(screen.getByText('Mới thêm vào thư viện')).toBeDefined();
    expect(screen.getByText('Mới cập nhật gần nhất')).toBeDefined();
    expect(screen.queryByText('Tên truyện (A → Z)')).toBeNull();
    expect(screen.queryByText('Lần đọc gần nhất')).toBeNull();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <SortSheet
        isOpen={false}
        currentSortBy="updatedAt"
        currentSortOrder="DESC"
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('selects option and calls onApply with correct values', () => {
    render(
      <SortSheet
        isOpen={true}
        currentSortBy="createdAt"
        currentSortOrder="DESC"
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    );

    const updatedAtOption = screen.getByText('Mới cập nhật gần nhất');
    fireEvent.click(updatedAtOption);

    const applyButton = screen.getByText('Áp dụng');
    fireEvent.click(applyButton);

    expect(mockOnApply).toHaveBeenCalledWith('updatedAt', 'DESC');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('resets to default sort when clicking Mặc định', () => {
    render(
      <SortSheet
        isOpen={true}
        currentSortBy="updatedAt"
        currentSortOrder="DESC"
        defaultSortBy="createdAt"
        defaultSortOrder="DESC"
        onApply={mockOnApply}
        onClose={mockOnClose}
      />
    );

    const defaultButton = screen.getByText('Mặc định');
    fireEvent.click(defaultButton);

    const applyButton = screen.getByText('Áp dụng');
    fireEvent.click(applyButton);

    expect(mockOnApply).toHaveBeenCalledWith('createdAt', 'DESC');
  });
});
