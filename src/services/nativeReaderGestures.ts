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
	configureSwipe(options: {
		enabled: boolean;
		owner: string;
		threshold: number;
		minVelocity: number;
		maxDuration?: number;
		edgeIgnoreWidth: number;
	}): Promise<void>;
	configureSheet(options: { enabled: boolean; owner: string }): Promise<void>;
}

const plugin = registerPlugin<ReaderGesturesPlugin>('ReaderGestures');
export const hasNativeReaderGestures = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ReaderGestures');

function parseControlOrSwipeMove(detail: Record<string, unknown>): NativeReaderGesture | null {
	if (detail.kind !== 'control-move' && detail.kind !== 'swipe-move') return null;
	if (typeof detail.offset !== 'number' || !Number.isFinite(detail.offset)) return null;
	return { kind: detail.kind, offset: detail.offset };
}

function parseSheetGesture(detail: Record<string, unknown>): NativeReaderGesture | null {
	if (detail.kind !== 'sheet-move' && detail.kind !== 'sheet-end') return null;
	if (typeof detail.owner !== 'string') return null;
	if (detail.kind === 'sheet-move' && typeof detail.offset === 'number' && Number.isFinite(detail.offset)) {
		return { kind: 'sheet-move', owner: detail.owner, offset: detail.offset };
	}
	if (detail.kind === 'sheet-end' && typeof detail.dismiss === 'boolean') {
		return { kind: 'sheet-end', owner: detail.owner, dismiss: detail.dismiss };
	}
	return null;
}

function parseSwipeEnd(detail: Record<string, unknown>): NativeReaderGesture | null {
	if (detail.kind !== 'swipe-end') return null;
	if (detail.settled === 'left' || detail.settled === 'right' || detail.settled === 'cancel') {
		return { kind: 'swipe-end', settled: detail.settled };
	}
	return null;
}

function parseSimpleGesture(obj: Record<string, unknown>): NativeReaderGesture | null {
	if (obj.kind === 'interaction-start' || obj.kind === 'interaction-end') {
		return { kind: obj.kind };
	}
	if (obj.kind === 'refresh' && typeof obj.requestId === 'string') {
		return { kind: 'refresh', requestId: obj.requestId };
	}
	return null;
}

function parseNativeGesture(detail: unknown): NativeReaderGesture | null {
	if (!detail || typeof detail !== 'object' || !('kind' in detail)) return null;
	const obj = detail as Record<string, unknown>;
	const simple = parseSimpleGesture(obj);
	if (simple) return simple;
	const move = parseControlOrSwipeMove(obj);
	if (move) return move;
	const swipeEnd = parseSwipeEnd(obj);
	if (swipeEnd) return swipeEnd;
	return parseSheetGesture(obj);
}

export function onNativeReaderGesture(listener: (gesture: NativeReaderGesture) => void): () => void {
	if (!hasNativeReaderGestures()) return () => {};
	const receive = (event: Event) => {
		const gesture = parseNativeGesture((event as CustomEvent<unknown>).detail);
		if (gesture) listener(gesture);
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
