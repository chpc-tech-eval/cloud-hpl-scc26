import type { ComponentInstance } from '../../types/astro.js';
import type { RouteData } from '../../types/public/internal.js';
import type { SSRManifest } from '../app/types.js';
import type { ValidateRouteForRewrite } from './rewrite.js';
/**
 * Creates the check `findRouteToRewrite` runs on a dynamic route whose
 * `distURL` is empty. Returns `true` when `getStaticPaths()` produces the
 * pathname, `false` when it throws `NoMatchingStaticPathFound`, and rethrows
 * any other error so a broken `getStaticPaths()` is not hidden as a 404.
 */
export declare function createRewriteRouteValidator(manifest: SSRManifest, getComponentByRoute: (manifest: SSRManifest, route: RouteData) => Promise<ComponentInstance>): ValidateRouteForRewrite;
