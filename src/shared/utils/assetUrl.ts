/**
 * Resolves static asset URLs relative to Vite's base path (import.meta.env.BASE_URL).
 * Guarantees correct paths on subpath deployments like GitHub Pages (e.g. /repository-name/audio/...).
 */
interface CustomImportMeta {
	env?: {
		BASE_URL?: string;
	};
}

export function getAssetUrl(path: string, customBase?: string): string {
	if (!path) return path;

	// Absolute HTTP/HTTPS URLs or Base64 Data URLs return as-is
	if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
		return path;
	}

	const rawBase = customBase ?? (import.meta as unknown as CustomImportMeta).env?.BASE_URL ?? '/';
	const cleanPath = path.startsWith('/') ? path.slice(1) : path;

	// Strip leading '.' for relative base paths (e.g. './' or '.') so it doesn't corrupt origin concatenation
	let normalizedBase = rawBase.startsWith('.') ? rawBase.replace(/^\.+/, '') : rawBase;
	if (!normalizedBase.startsWith('/')) {
		normalizedBase = `/${normalizedBase}`;
	}
	if (!normalizedBase.endsWith('/')) {
		normalizedBase = `${normalizedBase}/`;
	}

	if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
		const origin = window.location.origin.replace(/\/+$/, '');
		return `${origin}${normalizedBase}${cleanPath}`;
	}

	return `${normalizedBase}${cleanPath}`;
}
