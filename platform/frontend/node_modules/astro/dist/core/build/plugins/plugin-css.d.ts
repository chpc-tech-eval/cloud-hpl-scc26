import type { Plugin as VitePlugin } from 'vite';
import type { BuildInternals } from '../internal.js';
import type { StaticBuildOptionsInput } from '../types.js';
/***** ASTRO PLUGIN *****/
export declare function pluginCSS(options: StaticBuildOptionsInput, internals: BuildInternals): VitePlugin[];
