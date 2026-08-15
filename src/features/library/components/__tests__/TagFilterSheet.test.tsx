// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TagFilterSheet } from '../TagFilterSheet';
import { TagRepository } from '../../../../repositories/TagRepository';

const MOCK_CATEGORIES = [
  {
    name: 'Thể loại R18 & Quan hệ',
    tags: ['Sắc Hiệp', 'Thuần Dục', 'Mẹ Kế'],
  },
  {
    name: 'Bối cảnh & Thể loại chính',
    tags: ['Tiên Hiệp', 'Đô Thị'],
  },
  {
    name: 'Phong cách & Cốt truyện',
    tags: ['Hệ Thống', 'Xuyên Không'],
  },
];

describe('TagFilterSheet Component', () => {
  beforeEach(() => {
    vi.spyOn(TagRepository, 'getTags').mockResolvedValue({
      categories: MOCK_CATEGORIES,
      tags: MOCK_CATEGORIES.flatMap((c) => c.tags),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <TagFilterSheet
        isOpen={false}
        selectedTags={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render categories and tags when isOpen is true', async () => {
    render(
      <TagFilterSheet
        isOpen={true}
        selectedTags={['Tiên Hiệp']}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Bộ lọc Thể loại & Tags')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('Thể loại R18 & Quan hệ')).toBeDefined();
      expect(screen.getByTestId('tag-chip-Tiên Hiệp')).toBeDefined();
    });
  });

  it('should load dynamic categories from TagRepository.getTags', async () => {
    vi.spyOn(TagRepository, 'getTags').mockResolvedValue({
      categories: [
        {
          name: 'Danh mục Backend Mới',
          tags: ['Tag Tùy Biến 1', 'Tag Tùy Biến 2'],
        },
      ],
      tags: ['Tag Tùy Biến 1', 'Tag Tùy Biến 2'],
    });

    render(
      <TagFilterSheet
        isOpen={true}
        selectedTags={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Danh mục Backend Mới')).toBeDefined();
      expect(screen.getByTestId('tag-chip-Tag Tùy Biến 1')).toBeDefined();
    });
  });

  it('should filter tags by search input', async () => {
    render(
      <TagFilterSheet
        isOpen={true}
        selectedTags={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tag-chip-Xuyên Không')).toBeDefined();
    });

    const searchInput = screen.getByTestId('tag-search-input');
    fireEvent.change(searchInput, { target: { value: 'Xuyên Không' } });

    expect(screen.getByTestId('tag-chip-Xuyên Không')).toBeDefined();
    expect(screen.queryByTestId('tag-chip-Tiên Hiệp')).toBeNull();
  });

  it('should allow toggling tags and applying selected tags', async () => {
    const onApplyMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <TagFilterSheet
        isOpen={true}
        selectedTags={['Tiên Hiệp']}
        onApply={onApplyMock}
        onClose={onCloseMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tag-chip-Hệ Thống')).toBeDefined();
    });

    // Toggle another tag "Hệ Thống"
    const heThongChip = screen.getByTestId('tag-chip-Hệ Thống');
    fireEvent.click(heThongChip);

    // Click Apply button
    const applyBtn = screen.getByTestId('tag-filter-apply-btn');
    fireEvent.click(applyBtn);

    expect(onApplyMock).toHaveBeenCalledWith(['Tiên Hiệp', 'Hệ Thống']);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should reset selected tags when clicking reset button', async () => {
    const onApplyMock = vi.fn();

    render(
      <TagFilterSheet
        isOpen={true}
        selectedTags={['Tiên Hiệp']}
        onApply={onApplyMock}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tag-filter-reset-btn')).toBeDefined();
    });

    const resetBtn = screen.getByTestId('tag-filter-reset-btn');
    fireEvent.click(resetBtn);

    const applyBtn = screen.getByTestId('tag-filter-apply-btn');
    fireEvent.click(applyBtn);

    expect(onApplyMock).toHaveBeenCalledWith([]);
  });
});
