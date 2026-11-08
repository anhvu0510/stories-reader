/** Compatibility export: native and web reading share one playback controller. */
export { useReadAloud as useNativeReadAloud } from './useReadAloud';
import type { useReadAloud } from './useReadAloud';
export type UseNativeReadAloudResult = ReturnType<typeof useReadAloud>;
