/**
 * Resolves static asset URLs relative to Vite's base path (import.meta.env.BASE_URL).
 * Guarantees correct paths on subpath deployments like GitHub Pages (e.g. /repository-name/audio/...).
 */
interface CustomImportMeta {
	env?: {
		BASE_URL?: string;
	};
}

function isPassthroughUrl(path: string): boolean {
	return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:');
}

function normalizeBase(rawBase: string): string {
	// Strip leading '.' for relative base paths (e.g. './' or '.') so it doesn't corrupt origin concatenation
	let normalizedBase = rawBase.startsWith('.') ? rawBase.replace(/^\.+/, '') : rawBase;
	if (!normalizedBase.startsWith('/')) {
		normalizedBase = `/${normalizedBase}`;
	}
	if (!normalizedBase.endsWith('/')) {
		normalizedBase = `${normalizedBase}/`;
	}
	return normalizedBase;
}

function getWindowOrigin(): string | null {
	if (typeof window === 'undefined') return null;
	const origin = window.location?.origin;
	if (!origin || origin === 'null') return null;
	return origin.replace(/\/+$/, '');
}

export function getAssetUrl(path: string, customBase?: string): string {
	if (!path) return path;

	// Absolute HTTP/HTTPS URLs or Base64 Data URLs return as-is
	if (isPassthroughUrl(path)) return path;

	const rawBase = customBase ?? (import.meta as unknown as CustomImportMeta).env?.BASE_URL ?? '/';
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;
	const normalizedBase = normalizeBase(rawBase);
	const origin = getWindowOrigin();

	return `${origin ?? ''}${normalizedBase}${cleanPath}`;
}
