import type { PluggableList, Plugin } from 'unified';
export interface BuildTimingsRecorder {
    record(kind: string, name: string, duration: number, meta?: Record<string, unknown>): void;
}
export declare function getBuildTimings(): BuildTimingsRecorder | undefined;
export declare function setBuildTimings(recorder: BuildTimingsRecorder | undefined): void;
export declare function recordTiming(kind: string, name: string, duration: number, meta?: Record<string, unknown>): void;
/** Calls `fn` and reports its elapsed time to `done`, once its promise settles if it returns one. */
export declare function measure<T>(fn: () => T, done: (elapsed: number) => void): T;
export declare function time<T>(kind: string, name: string, fn: () => T, meta?: Record<string, unknown>): T;
/** Attributes the time a unified plugin's transformer spends on each file to `name`. */
export declare function timedPlugin<T extends Plugin<any[], any>>(kind: string, name: string, plugin: T): T;
/** Names a unified plugin the way its package is usually spelled: `rehypeShiki` reads as `rehype-shiki`. */
export declare function pluggableName(pluggable: unknown, index: number, fallbackPrefix: string): string;
export declare function timedPluggableList(kind: string, list: PluggableList, fallbackPrefix: string): PluggableList;
/** Attributes the time a Sätteri mdast/hast plugin spends in its visitors to its own name. */
export declare function timedVisitorPlugins<T>(kind: string, entries: readonly T[]): T[];
