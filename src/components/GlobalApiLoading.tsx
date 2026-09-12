import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { LoadingOverlay } from './LoadingOverlay';

export function GlobalApiLoading() {
  const apiLoadingCount = useAppStore((state) => state.apiLoadingCount);
  const isLoading = apiLoadingCount > 0;

  return <LoadingOverlay isLoading={isLoading} message="Đang tải dữ liệu..." />;
}
