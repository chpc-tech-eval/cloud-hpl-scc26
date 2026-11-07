import type { AstroSettings } from '../../../types/astro.js';
import type { AstroLogger } from '../../logger/core.js';
export declare function withBuildTimings<T>(fn: () => Promise<T>): Promise<T>;
export declare function buildPhase<T>(name: string, fn: () => Promise<T>): Promise<T>;
export declare function buildTimingsVitePlugins(): import("vite").Plugin<any>[];
export declare function printBuildTimings(settings: AstroSettings, logger: AstroLogger): void;
