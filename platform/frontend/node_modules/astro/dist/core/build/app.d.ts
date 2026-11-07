import { BaseApp } from '../app/entrypoints/index.js';
import type { LogRequestPayload } from '../app/base.js';
import type { SSRManifest } from '../app/types.js';
import type { ComponentInstance } from '../../types/astro.js';
import type { GetStaticPathsItem } from '../../types/public/common.js';
import type { RouteData } from '../../types/public/internal.js';
import { type RouteCache } from '../render/route-cache.js';
import type { BuildEnvironmentInternals, BuildEnvironmentOptions, BuildEnvironmentSlots } from './environment.js';
/**
 * The build / prerender facade: a thin shell over the
 * build environment record. The two-phase init state (`setInternals` /
 * `setOptions`, injected by `createDefaultPrerenderer.setup()` after the
 * prerender bundle import) lives in the `BuildEnvironmentSlots` closure
 * created by the prerender entrypoint; the facade only forwards across the
 * bundle boundary into those slots.
 */
export declare class BuildApp extends BaseApp {
    #private;
    constructor(manifest: SSRManifest, buildEnv: BuildEnvironmentSlots);
    isDev(): boolean;
    /**
     * Streaming falls through to the environment default
     * (`manifest.serverLike` for the build environment) — we can skip
     * streaming in SSG for performance, as writing strings is faster.
     */
    protected resolveStreaming(): boolean | undefined;
    setInternals(internals: BuildEnvironmentInternals): void;
    setOptions(options: BuildEnvironmentOptions): void;
    getOptions(): BuildEnvironmentOptions;
    getSettings(): Pick<import("../../types/astro.js").AstroSettings, "scripts"> & {
        redirectPage: boolean;
    };
    /**
     * Route cache and component loader for `StaticPaths`. Defined on the app
     * (rather than reached through the functional core at the call site) so
     * they execute inside the prerender bundle's module graph: the default
     * prerenderer constructs `StaticPaths` from a different bundle, whose
     * copies of the core modules hold separate per-manifest state.
     */
    get routeCache(): RouteCache;
    getComponentByRoute(routeData: RouteData): Promise<ComponentInstance>;
    addStaticPath(routeData: RouteData, item: GetStaticPathsItem): Promise<void>;
    logRequest(_options: LogRequestPayload): void;
}
