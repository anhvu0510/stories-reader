// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BottomSheet } from '../BottomSheet';

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

  it('applies frosted glass styling by default or when glassmorphic is true', () => {
    render(
      <BottomSheet isOpen={true} onClose={mockOnClose} ariaLabel="Glass Sheet">
        <div>Sheet Content</div>
      </BottomSheet>
    );

    const sheetContainer = screen.getByTestId('bottom-sheet-container');
    expect(sheetContainer.className).toContain('backdrop-blur-sm');
    expect(sheetContainer.className).toContain('color-mix');
  });
});




