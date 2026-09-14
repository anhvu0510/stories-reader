// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ToastContainer } from '../Toast';
import { useToastStore, showToast } from '../../stores/useToastStore';

describe('Toast Component & Store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useToastStore.getState().removeToast();
    });
  });

  afterEach(() => {
    act(() => {
      useToastStore.getState().removeToast();
    });
    vi.useRealTimers();
    cleanup();
  });

  it('renders single active toast when showToast is called', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Đã thêm vào yêu thích', 'success');
    });

    expect(screen.getByText('Đã thêm vào yêu thích')).toBeDefined();
    expect(useToastStore.getState().activeToast?.message).toBe('Đã thêm vào yêu thích');
  });

  it('replaces active toast immediately when a new toast is shown', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Đã thêm vào yêu thích', 'success');
    });
    expect(useToastStore.getState().activeToast?.message).toBe('Đã thêm vào yêu thích');

    act(() => {
      showToast('Đã bỏ yêu thích', 'info');
      vi.advanceTimersByTime(300);
    });

    expect(useToastStore.getState().activeToast?.message).toBe('Đã bỏ yêu thích');
    expect(screen.getByText('Đã bỏ yêu thích')).toBeDefined();
  });

  it('auto-dismisses toast after duration', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Thông báo tự đóng', 'info');
    });

    expect(useToastStore.getState().activeToast?.message).toBe('Thông báo tự đóng');

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useToastStore.getState().activeToast).toBeNull();
  });

  it('removes toast when clicked', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Bấm để đóng', 'error');
    });

    const toastElement = screen.getByText('Bấm để đóng');
    act(() => {
      fireEvent.click(toastElement);
    });

    expect(useToastStore.getState().activeToast).toBeNull();
  });
});
