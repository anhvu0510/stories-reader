/**
 * Resolves static asset URLs relative to Vite's base path (import.meta.env.BASE_URL).
 * Guarantees correct paths on subpath deployments like GitHub Pages (e.g. /repository-name/audio/...).
 */
export function getAssetUrl(path: string): string {
  if (!path) return path;

  // Absolute HTTP/HTTPS URLs or Base64 Data URLs return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  const baseUrl = metaEnv?.BASE_URL || '/';
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalizedBase}${cleanPath}`;
  }

  return `${normalizedBase}${cleanPath}`;
}
