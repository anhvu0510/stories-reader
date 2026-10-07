import { Capacitor } from '@capacitor/core';

/** The APK build type is authoritative, including production-built Vite assets. */
export function isNativeDebugBuild(): boolean {
	if (Capacitor.getPlatform() !== 'android') return false;
	const runtime: unknown = Reflect.get(globalThis, 'StoriesRuntime');
	if (!runtime || typeof runtime !== 'object') return false;
	const isDebugBuild: unknown = Reflect.get(runtime, 'isDebugBuild');
	return typeof isDebugBuild === 'function' && isDebugBuild.call(runtime) === true;
}
