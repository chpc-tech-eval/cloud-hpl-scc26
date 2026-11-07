import type { Plugin as VitePlugin } from 'vite';
import type { BuildInternals } from '../internal.js';
import type { StaticBuildOptionsInput } from '../types.js';
export declare function pluginPrerender(_opts: StaticBuildOptionsInput, internals: BuildInternals): VitePlugin;
