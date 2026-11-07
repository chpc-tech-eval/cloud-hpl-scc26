import type { Plugin } from 'vite';
import type { RoutesList } from '../types/astro.js';
interface AstroVitePluginOptions {
    routesList: RoutesList;
    command: 'dev' | 'build';
    /** Shared cache of CSS content by module ID. Populated by the transform hook and
     *  consumed by the content asset propagation plugin to avoid re-processing CSS
     *  modules with `?inline` (which can produce different scoped-name hashes with
     *  Lightning CSS). */
    cssContentCache: Map<string, string>;
}
/**
 * This plugin tracks the CSS that should be applied by route.
 *
 * The virtual module should be used only during development.
 * Per-route virtual modules are created to avoid invalidation loops.
 *
 * The second plugin imports all of the individual CSS modules in a map.
 *
 * @param routesList
 */
export declare function astroDevCssPlugin({ routesList, command, cssContentCache, }: AstroVitePluginOptions): Plugin[];
/**
 * Caches the final CSS of each module in `cssContentCache` during dev, so it can be inlined
 * into server-rendered HTML.
 *
 * Must be registered after all integration and user plugins: its normal-order `transform` then
 * runs after framework transforms (e.g. `@vitejs/plugin-vue` scoping SFC styles) and before
 * `vite:css-post` turns the CSS into JS. See #18333.
 */
export declare function astroDevCssContentCachePlugin({ cssContentCache, }: Pick<AstroVitePluginOptions, 'cssContentCache'>): Plugin;
export {};
