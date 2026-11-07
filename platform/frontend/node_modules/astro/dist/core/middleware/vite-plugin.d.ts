import type { Plugin as VitePlugin } from 'vite';
import type { AstroSettings } from '../../types/astro.js';
import type { BuildInternals } from '../build/internal.js';
export declare const MIDDLEWARE_MODULE_ID = "virtual:astro:middleware";
export declare function isMiddlewarePath(relativePath: string): boolean;
export declare function vitePluginMiddleware({ settings }: {
    settings: AstroSettings;
}): VitePlugin;
export declare function vitePluginMiddlewareBuild(internals: BuildInternals): VitePlugin;
