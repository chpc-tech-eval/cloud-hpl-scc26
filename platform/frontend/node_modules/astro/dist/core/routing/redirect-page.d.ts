import type { SSRManifest } from '../app/types.js';
/** Props handed to `src/pages/3xx.astro` for the redirect it stands in for. */
export interface RedirectPageProps {
    /** The pathname being redirected away from. */
    from: string;
    /** The redirect destination, as it appears in the `Location` header. */
    to: string;
    /** The HTTP status code of the redirect. */
    status: number;
    /**
     * Seconds Astro's built-in page would wait before refreshing. A short delay
     * makes search engines read the redirect as temporary, so `302` gets `2` and
     * everything else gets `0`.
     *
     * https://developers.google.com/search/docs/crawling-indexing/301-redirects#metarefresh
     */
    delay: number;
}
/** The delay Astro's built-in redirect page uses for `status`. */
export declare function redirectDelayFor(status: number): number;
/**
 * Renders the project's `src/pages/3xx.astro` as the body of a redirect,
 * returning its HTML.
 *
 * Returns `undefined` when the project has no `3xx.astro`, or when rendering it
 * fails — the caller falls back to Astro's built-in redirect page so a broken
 * custom page degrades to a working redirect instead of failing the build.
 *
 * Middleware is skipped: it already ran for the request that produced the
 * redirect, and re-running it around a template render would let a middleware
 * that redirects recurse.
 */
export declare function renderRedirectPage(manifest: SSRManifest, request: Request, props: RedirectPageProps): Promise<string | undefined>;
