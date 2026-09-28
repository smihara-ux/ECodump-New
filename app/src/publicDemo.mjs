// GitHub Pages hosts the static UX review only; it has no shared API.
export function isPublicDemoHost(hostname) {
  return hostname === 'smihara-ux.github.io';
}
export const publicDemo = isPublicDemoHost(globalThis.location?.hostname);
