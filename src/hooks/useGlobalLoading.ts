import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useGlobalLoading(isLoading: boolean) {
  useEffect(() => {
    if (isLoading) {
      useAppStore.getState().incrementApiLoading();
      return () => {
        useAppStore.getState().decrementApiLoading();
      };
    }
  }, [isLoading]);
}
