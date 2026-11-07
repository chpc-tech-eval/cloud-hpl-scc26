import type { AstroSettings } from '../../types/astro.js';
import type { RenderEnvironment } from '../environment/index.js';
import type { AstroLoggerDestination } from '../logger/core.js';
import type { BuildInternals } from './internal.js';
import type { PageBuildData } from './types.js';
export interface BuildEnvironmentInternals {
    pagesByKeys: Map<string, Pick<PageBuildData, 'styles'>>;
    entrySpecifierToBundleMap: BuildInternals['entrySpecifierToBundleMap'];
}
export interface BuildEnvironmentOptions {
    settings: Pick<AstroSettings, 'scripts'> & {
        redirectPage: boolean;
    };
    logger: {
        options: {
            destination: AstroLoggerDestination;
        };
    };
}
/**
 * The build / prerender environment record and its mutable closure slots.
 * The build has a two-phase initialization: the prerender bundle is imported
 * first, and `createDefaultPrerenderer.setup()` injects `BuildInternals` /
 * `StaticBuildOptions` afterwards through the facade. The slots live in this
 * closure; accessors throw before injection, and the environment functions
 * close over the same slots.
 */
export interface BuildEnvironmentSlots {
    /** The build `RenderEnvironment`; its functions close over the slots below. */
    env: RenderEnvironment;
    setInternals(internals: BuildEnvironmentInternals): void;
    setOptions(options: BuildEnvironmentOptions): void;
    /** Throws `No internals defined` before injection. */
    getInternals(): BuildEnvironmentInternals;
    /** Throws `No options defined` before injection. */
    getOptions(): BuildEnvironmentOptions;
    /** Throws `No options defined` before injection. */
    getSettings(): BuildEnvironmentOptions['settings'];
}
export declare function createBuildEnvironment(): BuildEnvironmentSlots;
