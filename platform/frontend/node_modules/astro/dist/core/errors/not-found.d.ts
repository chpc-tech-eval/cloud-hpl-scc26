import type { FetchState } from '../fetch/fetch-state.js';
/**
 * Renders the 404 error page when no route matched the request, or returns
 * `undefined` when a route matched. Returns an empty `400` when the request
 * path is over-encoded.
 *
 * `FetchState` only falls back to an SSR `404.astro`, so this renders a
 * prerendered (or absent) custom 404 page: through
 * `renderOptions.prerenderedErrorPageFetch` in production, or by rendering
 * the page source in dev.
 */
export declare function handleNotFound(state: FetchState): Promise<Response> | undefined;
