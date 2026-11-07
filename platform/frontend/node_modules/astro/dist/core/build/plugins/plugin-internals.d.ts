import type { Plugin as VitePlugin } from 'vite';
import type { BuildInternals } from '../internal.js';
import type { StaticBuildOptionsInput } from '../types.js';
export declare function pluginInternals(options: StaticBuildOptionsInput, internals: BuildInternals): VitePlugin;
