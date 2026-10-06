import { Capacitor, registerPlugin } from '@capacitor/core';

export const NATIVE_GESTURE_EVENT = 'stories-reader-native-gesture';
export type NativeReaderGesture =
	| { kind: 'interaction-start' | 'interaction-end' }
	| { kind: 'control-move'; offset: number }
	| { kind: 'refresh'; requestId: string }
	| { kind: 'swipe-move'; offset: number }
	| { kind: 'swipe-end'; settled: 'left' | 'right' | 'cancel' }
	| { kind: 'sheet-move'; offset: number; owner: string }
	| { kind: 'sheet-end'; dismiss: boolean; owner: string };

export interface NativeControlGeometry {
	enabled: boolean;
	viewportWidth?: number;
	left?: number;
	top?: number;
	right?: number;
	bottom?: number;
	offset?: number;
	minimum?: number;
	maximum?: number;
}

interface ReaderGesturesPlugin {
	configureControl(options: NativeControlGeometry): Promise<void>;
	configureRefresh(options: { enabled: boolean; owner: string; threshold: number }): Promise<void>;
	finishRefresh(options: { owner: string; requestId: string }): Promise<void>;
	configureSwipe(options: { enabled: boolean; owner: string; threshold: number; minVelocity: number; maxDuration?: number; edgeIgnoreWidth: number }): Promise<void>;
	configureSheet(options: { enabled: boolean; owner: string }): Promise<void>;
}

const plugin = registerPlugin<ReaderGesturesPlugin>('ReaderGestures');
export const hasNativeReaderGestures = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ReaderGestures');

export function onNativeReaderGesture(listener: (gesture: NativeReaderGesture) => void): () => void {
	if (!hasNativeReaderGestures()) return () => {};
	const receive = (event: Event) => {
		const detail: unknown = (event as CustomEvent<unknown>).detail;
		if (!detail || typeof detail !== 'object' || !('kind' in detail)) return;
		if (detail.kind === 'interaction-start' || detail.kind === 'interaction-end') listener({ kind: detail.kind });
		if (detail.kind === 'control-move' && 'offset' in detail && typeof detail.offset === 'number' && Number.isFinite(detail.offset)) listener({ kind: detail.kind, offset: detail.offset });
		if (detail.kind === 'refresh' && 'requestId' in detail && typeof detail.requestId === 'string') listener({ kind: detail.kind, requestId: detail.requestId });
		if (detail.kind === 'swipe-move' && 'offset' in detail && typeof detail.offset === 'number' && Number.isFinite(detail.offset)) listener({ kind: detail.kind, offset: detail.offset });
		if (detail.kind === 'swipe-end' && 'settled' in detail && (detail.settled === 'left' || detail.settled === 'right' || detail.settled === 'cancel')) listener({ kind: detail.kind, settled: detail.settled });
		if (detail.kind === 'sheet-move' && 'owner' in detail && typeof detail.owner === 'string' && 'offset' in detail && typeof detail.offset === 'number' && Number.isFinite(detail.offset)) listener({ kind: detail.kind, owner: detail.owner, offset: detail.offset });
		if (detail.kind === 'sheet-end' && 'owner' in detail && typeof detail.owner === 'string' && 'dismiss' in detail && typeof detail.dismiss === 'boolean') listener({ kind: detail.kind, owner: detail.owner, dismiss: detail.dismiss });
	};
	window.addEventListener(NATIVE_GESTURE_EVENT, receive);
	return () => window.removeEventListener(NATIVE_GESTURE_EVENT, receive);
}

export function configureNativeControl(geometry: NativeControlGeometry): void {
	if (!hasNativeReaderGestures()) return;
	void plugin.configureControl(geometry).catch(reportBridgeError);
}

export function configureNativeRefresh(options: { enabled: boolean; owner: string; threshold: number }): void {
	if (!hasNativeReaderGestures()) return;
	void plugin.configureRefresh(options).catch(reportBridgeError);
}

export async function finishNativeRefresh(owner: string, requestId: string): Promise<void> {
	if (!hasNativeReaderGestures()) return;
	await plugin.finishRefresh({ owner, requestId });
}

function reportBridgeError(error: unknown): void {
	console.error('[ReaderGestures] Native bridge failed:', error);
}

export function configureNativeSwipe(options: Parameters<ReaderGesturesPlugin['configureSwipe']>[0]): void {
	if (!hasNativeReaderGestures()) return;
	void plugin.configureSwipe(options).catch(reportBridgeError);
}

export function configureNativeSheet(options: { enabled: boolean; owner: string }): void {
	if (!hasNativeReaderGestures()) return;
	void plugin.configureSheet(options).catch(reportBridgeError);
}

type GestureKind = 'refresh' | 'swipe' | 'sheet';
type HitTest = (x: number, y: number) => boolean;
const hitTests = new Map<GestureKind, Map<string, HitTest>>();
declare global {
	interface Window {
		__storiesNativeGestureHitTest?: (x: number, y: number, refresh: string, swipe: string, sheet: string) => Record<GestureKind, boolean>;
	}
}

export function registerNativeGestureHitTest(kind: GestureKind, owner: string, test: HitTest): () => void {
	const entries = hitTests.get(kind) ?? new Map<string, HitTest>();
	entries.set(owner, test);
	hitTests.set(kind, entries);
	window.__storiesNativeGestureHitTest = (x, y, refresh, swipe, sheet) => {
		const check = (key: GestureKind, expected: string) => {
			const current = hitTests.get(key)?.get(expected);
			return Boolean(current?.(x, y));
		};
		return { refresh: check('refresh', refresh), swipe: check('swipe', swipe), sheet: check('sheet', sheet) };
	};
	return () => {
		if (hitTests.get(kind)?.get(owner) !== test) return;
		entries.delete(owner);
		if (entries.size === 0) hitTests.delete(kind);
		if (hitTests.size === 0) delete window.__storiesNativeGestureHitTest;
	};
}
