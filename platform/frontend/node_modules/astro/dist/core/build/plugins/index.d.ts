import type { Plugin as VitePlugin } from 'vite';
import type { BuildInternals } from '../internal.js';
import type { StaticBuildOptionsInput } from '../types.js';
export declare function getAllBuildPlugins(internals: BuildInternals, options: StaticBuildOptionsInput): Array<VitePlugin | VitePlugin[] | undefined>;
