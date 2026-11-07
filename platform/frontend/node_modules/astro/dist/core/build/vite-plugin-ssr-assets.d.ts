import type { Plugin } from 'vite';
import { type BuildInternals } from './internal.js';
/**
 * Vite plugin that tracks emitted assets.
 * This plugin coordinates with emitClientAsset() to track which assets should
 * be moved to the client directory. The resolved filenames are stored in
 * BuildInternals.ssrAssetsPerEnvironment during generateBundle.
 */
export declare function vitePluginSSRAssets(internals: BuildInternals): Plugin;
/**
 * Deletes the .vite folder from a directory if it exists.
 */
export declare function removeViteManifestDirectories(directories: Iterable<URL>): Promise<void>;
