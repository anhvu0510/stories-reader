import type { ReadAloudScrollFollower } from './readAloudScrollFollower';
import { onNativeReaderGesture } from './nativeReaderGestures';

export function bindNativeReadingInteraction(follower: ReadAloudScrollFollower, onInteraction?: () => void): () => void {
	const suspend = () => { onInteraction?.(); follower.notifyUserInteraction(); };
	const selection = () => follower.notifySelectionChange();
	const unsubscribe = onNativeReaderGesture((gesture) => {
		if (gesture.kind === 'interaction-start') { onInteraction?.(); follower.beginUserInteraction(); }
		if (gesture.kind === 'interaction-end') follower.endUserInteraction();
	});
	window.addEventListener('wheel', suspend, { passive: true, capture: true });
	window.addEventListener('keydown', suspend, { capture: true });
	document.addEventListener('selectionchange', selection);
	return () => {
		unsubscribe();
		window.removeEventListener('wheel', suspend, true);
		window.removeEventListener('keydown', suspend, true);
		document.removeEventListener('selectionchange', selection);
	};
}
