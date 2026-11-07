import type { FetchState } from '../fetch/fetch-state.js';
/**
 * Handles trailing-slash normalization for incoming requests. If the
 * request's pathname does not match the manifest's configured
 * `trailingSlash` policy, a redirect `Response` is returned. Otherwise,
 * returns `undefined` so the caller can continue processing the request.
 * Paths encoded too many times to decode get a 400 instead of a redirect.
 */
export declare function handleTrailingSlash(state: FetchState): Response | undefined;
