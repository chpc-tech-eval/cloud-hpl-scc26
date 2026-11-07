import type { Environment, Rolldown } from 'vite';
type EmitFileOptions = Parameters<Rolldown.PluginContext['emitFile']>[0];
/**
 * Gets or creates the handle set for an environment
 */
export declare function getHandles(env: Environment): Set<string>;
/**
 * Resets the handle tracking for an environment.
 * Called at the start of each build.
 */
export declare function resetHandles(env: Environment): void;
/**
 * Emit a client asset and track it for later movement to the client directory.
 * Use this instead of pluginContext.emitFile for assets that should
 * be moved from the server/prerender directory to the client directory.
 *
 * Note: The pluginContext is typed as Rolldown.PluginContext for compatibility
 * with content entry types, but in practice it will always have the `environment`
 * property when running in Vite.
 */
export declare function emitClientAsset(pluginContext: Rolldown.PluginContext, options: EmitFileOptions): string;
export declare const ASSETS_ESM_PLUGIN_NAME = "astro:assets:esm";
export interface AssetsPluginApi {
    markReferenced(fsPath: string): void;
    readonly referencedImages: ReadonlySet<string>;
}
export declare function getAssetsPluginApi(plugins: readonly {
    name: string;
    api?: any;
}[] | undefined): AssetsPluginApi | undefined;
/** Keeps an image's original file in the build output, as if its `src` had been read. */
export declare function markImageReferenced(pluginContext: Rolldown.PluginContext, fsPath: string): void;
export {};
