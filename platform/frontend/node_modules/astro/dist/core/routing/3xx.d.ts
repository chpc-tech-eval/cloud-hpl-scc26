type RedirectTemplate = {
    from?: string;
    absoluteLocation: string | URL;
    status: number;
    relativeLocation: string;
};
/**
 * Generates a minimal HTML redirect page used for SSR redirects.
 */
export declare function redirectTemplate({ status, absoluteLocation, relativeLocation, from, }: RedirectTemplate): string;
/**
 * Reports whether `html` contains a `<meta http-equiv="refresh">` tag pointing at
 * `location`.
 *
 * In a static build the meta refresh tag *is* the redirect — there is no `Location`
 * header — so a redirect page that omits it, or points it somewhere else, silently
 * strands visitors.
 */
export declare function hasMetaRefreshTo(html: string, location: string): boolean;
export {};
