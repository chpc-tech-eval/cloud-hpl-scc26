import type { PrerenderResult } from '../../types/public/integrations.js';
import type { RouteData } from '../../types/public/internal.js';
import type { AstroLogger } from '../logger/core.js';
import type { SSRManifest } from './types.js';
export interface PrerenderableApp {
    logger: AstroLogger;
    /**
     * The app's manifest. When present, render errors use build semantics (they
     * throw instead of rendering a 500 page) for this manifest.
     */
    manifest?: SSRManifest;
    render(request: Request, opts: {
        routeData?: RouteData;
    }): Promise<Response>;
}
export interface PrerenderRenderOptions {
    routeData?: RouteData;
    /** @deprecated Metadata is always collected. */
    collectMetadata?: boolean;
    /** See {@link CollectPrerenderMetadataOptions.staticImages}. Default `true`. */
    staticImages?: boolean;
}
/**
 * Renders a single prerendered path through `app.render`, collecting the
 * per-render metadata (content entries rendered, image transforms resolved)
 * and returning it by value on the result.
 *
 * The response body is fully buffered *inside* the render scope so
 * lazily-driven rendering work records before the metadata snapshot; the
 * returned response is a reconstruction carrying the buffered body with
 * status/statusText/headers and body-nullness preserved.
 *
 * This function performs no scope installation; installing a render scope for
 * the rendering runtime is the caller's responsibility. When no scope is
 * installed, `metadata` is `undefined` ("not tracked").
 */
export declare function renderForPrerender(app: PrerenderableApp, request: Request, options?: PrerenderRenderOptions): Promise<PrerenderResult>;
